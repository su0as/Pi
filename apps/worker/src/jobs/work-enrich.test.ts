import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { WorkerEnv } from "@repo/config/env/worker";
import {
  authorships,
  institutions,
  topics,
  workIdentifiers,
  works,
  workTopics,
  workVersions,
} from "@repo/db/schema";
import type { NormalizedWork } from "@repo/sources";
import { upsertNormalizedWork } from "@repo/sources";
import { and, eq } from "drizzle-orm";
import pino from "pino";
import { afterAll, describe, expect, it } from "vitest";
import { createWorkerDb } from "../db.js";
import { buildOpenAlexEnrichmentConfig, runWorkEnrich } from "./work-enrich.js";

function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), "utf8");
}

function fakeFetch(status: number, body: string): typeof fetch {
  return (async () => new Response(body, { status })) as typeof fetch;
}

function testEnv(): WorkerEnv {
  return {
    NODE_ENV: "test",
    DATABASE_URL: process.env.DATABASE_URL ?? "postgres://pi:pi_dev_password@localhost:5432/pi_dev",
    ARXIV_CONTACT_EMAIL: "test@example.com",
    HARVEST_CATEGORIES: ["cs.RO"],
    HARVEST_CRON: "0 3 * * *",
    HARVEST_CRON_TZ: "UTC",
    HARVEST_BULK_WINDOW_MONTHS: 6,
  };
}

const db = createWorkerDb(testEnv());
const logger = pino({ enabled: false });
const TEST_DOI = "10.7554/elife.52157-worker-test";

function testWork(): NormalizedWork {
  return {
    title: "Open exploration",
    abstract: "Test abstract.",
    language: "en",
    workType: "article",
    publishedAt: new Date("2020-01-09"),
    identifiers: [{ scheme: "doi", valueNormalized: TEST_DOI, valueRaw: TEST_DOI }],
    authors: [
      { name: "William Hedley Thompson", position: 1 },
      { name: "Jessey Wright", position: 2 },
    ],
    categories: [],
    version: {
      source: "crossref",
      versionLabel: "v1",
      publishedAt: new Date("2020-01-09"),
      license: null,
      licenseUrl: null,
      pdfUrl: null,
      htmlUrl: null,
      sourceUrl: null,
    },
  };
}

async function cleanup(workId: string | undefined, rorId: string): Promise<void> {
  if (workId) {
    await db.update(authorships).set({ institutionId: null }).where(eq(authorships.workId, workId));
    await db.delete(workTopics).where(eq(workTopics.workId, workId));
    await db.delete(authorships).where(eq(authorships.workId, workId));
    await db.delete(workVersions).where(eq(workVersions.workId, workId));
    await db.delete(workIdentifiers).where(eq(workIdentifiers.workId, workId));
    await db.delete(works).where(eq(works.id, workId));
  }
  const [topic] = await db
    .select({ id: topics.id })
    .from(topics)
    .where(and(eq(topics.scheme, "openalex"), eq(topics.code, "T10206")))
    .limit(1);
  if (topic) await db.delete(topics).where(eq(topics.id, topic.id));
  await db.delete(institutions).where(eq(institutions.rorId, rorId));
}

describe("runWorkEnrich", () => {
  afterAll(async () => {
    await db.$client.end();
  });

  it("applies real OpenAlex enrichment (institutions, per-author linking, topics) to an ingested work", async () => {
    const { workId } = await upsertNormalizedWork(db, testWork());
    const config = buildOpenAlexEnrichmentConfig(
      testEnv(),
      fakeFetch(200, fixture("openalex-work-W2998766662.json")),
    );

    try {
      await runWorkEnrich(db, { workId, doi: TEST_DOI }, config, logger);

      const [institution] = await db
        .select()
        .from(institutions)
        .where(eq(institutions.rorId, "https://ror.org/056d84691"))
        .limit(1);
      expect(institution?.name).toBe("Karolinska Institutet");

      const authorRows = await db
        .select()
        .from(authorships)
        .where(eq(authorships.workId, workId))
        .orderBy(authorships.position);
      expect(authorRows[0]?.institutionId).toBe(institution?.id);

      const topicRows = await db.select().from(workTopics).where(eq(workTopics.workId, workId));
      expect(topicRows.length).toBeGreaterThan(0);
    } finally {
      await cleanup(workId, "https://ror.org/056d84691");
    }
  });

  it("does nothing (and doesn't throw) when OpenAlex has no record of the DOI", async () => {
    const { workId } = await upsertNormalizedWork(db, testWork());
    const config = buildOpenAlexEnrichmentConfig(testEnv(), fakeFetch(404, ""));

    try {
      await expect(
        runWorkEnrich(db, { workId, doi: TEST_DOI }, config, logger),
      ).resolves.toBeUndefined();

      const topicRows = await db.select().from(workTopics).where(eq(workTopics.workId, workId));
      expect(topicRows).toHaveLength(0);
    } finally {
      await cleanup(workId, "https://ror.org/056d84691");
    }
  });
});
