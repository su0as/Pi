import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { WorkerEnv } from "@repo/config/env/worker";
import {
  authorships,
  ingestionCheckpoints,
  workIdentifiers,
  works,
  workTopics,
  workVersions,
} from "@repo/db/schema";
import { and, eq } from "drizzle-orm";
import pino from "pino";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buildSourceConnectors } from "../connectors.js";
import { createWorkerDb } from "../db.js";
import { QUEUE_NAMES } from "../queue.js";
import { resolveSince, runArxivHarvest } from "./arxiv-harvest.js";

function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), "utf8");
}

function fixtureRouter(routes: Record<string, { status: number; body: string }>): typeof fetch {
  return (async (input: string | URL) => {
    const url = String(input);
    for (const [match, { status, body }] of Object.entries(routes)) {
      if (url.includes(match)) return new Response(body, { status });
    }
    throw new Error(`fixtureRouter: no fixture registered for ${url}`);
  }) as typeof fetch;
}

const TEST_ARXIV_IDS = ["2309.10164", "2402.17937", "2609.28467"];

function testEnv(overrides: Partial<WorkerEnv> = {}): WorkerEnv {
  return {
    NODE_ENV: "test",
    DATABASE_URL: process.env.DATABASE_URL ?? "postgres://pi:pi_dev_password@localhost:5432/pi_dev",
    ARXIV_CONTACT_EMAIL: "test@example.com",
    HARVEST_CATEGORIES: ["cs.RO"],
    HARVEST_CRON: "0 3 * * *",
    HARVEST_CRON_TZ: "UTC",
    HARVEST_BULK_WINDOW_MONTHS: 6,
    OBJECT_STORAGE_BUCKET: "pi-dev",
    OBJECT_STORAGE_REGION: "us-east-1",
    OBJECT_STORAGE_ENDPOINT: "http://localhost:8333",
    OBJECT_STORAGE_ACCESS_KEY_ID: "pi_dev_access_key",
    OBJECT_STORAGE_SECRET_ACCESS_KEY: "pi_dev_secret_key_change_me",
    READER_PIPELINE_VERSION: 1,
    ...overrides,
  };
}

const db = createWorkerDb(testEnv());
const logger = pino({ enabled: false });

async function cleanupWorks(): Promise<void> {
  for (const arxivId of TEST_ARXIV_IDS) {
    const [identifier] = await db
      .select({ workId: workIdentifiers.workId })
      .from(workIdentifiers)
      .where(and(eq(workIdentifiers.scheme, "arxiv"), eq(workIdentifiers.valueNormalized, arxivId)))
      .limit(1);
    if (!identifier) continue;
    await db.delete(authorships).where(eq(authorships.workId, identifier.workId));
    await db.delete(workTopics).where(eq(workTopics.workId, identifier.workId));
    await db.delete(workVersions).where(eq(workVersions.workId, identifier.workId));
    await db.delete(workIdentifiers).where(eq(workIdentifiers.workId, identifier.workId));
    await db.delete(works).where(eq(works.id, identifier.workId));
  }
}

async function cleanupCheckpoint(): Promise<void> {
  await db
    .delete(ingestionCheckpoints)
    .where(eq(ingestionCheckpoints.jobName, QUEUE_NAMES.arxivHarvest));
}

afterAll(async () => {
  await cleanupWorks();
  await cleanupCheckpoint();
  await db.$client.end();
});

describe("resolveSince", () => {
  beforeEach(cleanupCheckpoint);

  it("falls back to the configurable bulk window when there's no prior checkpoint", async () => {
    const env = testEnv({ HARVEST_BULK_WINDOW_MONTHS: 3 });
    const since = await resolveSince(db, env);

    const expected = new Date();
    expected.setUTCMonth(expected.getUTCMonth() - 3);
    expect(Math.abs(since.getTime() - expected.getTime())).toBeLessThan(5_000);
  });

  it("resumes from the recorded checkpoint when one exists", async () => {
    const lastRunAt = new Date("2026-01-01T00:00:00Z");
    await db.insert(ingestionCheckpoints).values({
      id: crypto.randomUUID(),
      jobName: QUEUE_NAMES.arxivHarvest,
      lastRunAt,
    });

    const since = await resolveSince(db, testEnv());
    expect(since.toISOString()).toBe(lastRunAt.toISOString());
  });
});

describe("runArxivHarvest", () => {
  beforeEach(async () => {
    await cleanupWorks();
    await cleanupCheckpoint();
  });

  it("ingests every record from a real OAI-PMH page and enqueues enrichment only for DOI-bearing works", async () => {
    const env = testEnv();
    const connectors = buildSourceConnectors(
      env,
      fixtureRouter({
        "set=cs%3Acs%3ARO": { status: 200, body: fixture("arxiv-oai-listrecords-page.xml") },
      }),
    );
    const enqueued: { workId: string; doi: string }[] = [];

    const summary = await runArxivHarvest(db, connectors, env, logger, async (workId, doi) => {
      enqueued.push({ workId, doi });
    });

    expect(summary.ingestedCount).toBe(3);
    expect(summary.enrichableCount).toBe(1);
    expect(enqueued).toHaveLength(1);
    expect(enqueued[0]?.doi).toBe("10.3389/frobt.2026.1802622");

    for (const arxivId of TEST_ARXIV_IDS) {
      const [identifier] = await db
        .select({ workId: workIdentifiers.workId })
        .from(workIdentifiers)
        .where(
          and(eq(workIdentifiers.scheme, "arxiv"), eq(workIdentifiers.valueNormalized, arxivId)),
        )
        .limit(1);
      expect(identifier, `expected ${arxivId} to be ingested`).toBeTruthy();
    }

    const [checkpoint] = await db
      .select()
      .from(ingestionCheckpoints)
      .where(eq(ingestionCheckpoints.jobName, QUEUE_NAMES.arxivHarvest))
      .limit(1);
    expect(checkpoint).toBeTruthy();
  });

  it("is idempotent: re-harvesting the same page doesn't duplicate works", async () => {
    const env = testEnv();
    const connectors = buildSourceConnectors(
      env,
      fixtureRouter({
        "set=cs%3Acs%3ARO": { status: 200, body: fixture("arxiv-oai-listrecords-page.xml") },
      }),
    );

    await runArxivHarvest(db, connectors, env, logger, async () => {});
    await runArxivHarvest(db, connectors, env, logger, async () => {});

    for (const arxivId of TEST_ARXIV_IDS) {
      const rows = await db
        .select()
        .from(workIdentifiers)
        .where(
          and(eq(workIdentifiers.scheme, "arxiv"), eq(workIdentifiers.valueNormalized, arxivId)),
        );
      expect(rows).toHaveLength(1);
    }
  });
});
