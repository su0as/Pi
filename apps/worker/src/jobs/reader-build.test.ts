import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { WorkerEnv } from "@repo/config/env/worker";
import {
  authorships,
  readerDocuments,
  workIdentifiers,
  works,
  workVersions,
} from "@repo/db/schema";
import { type NormalizedWork, upsertNormalizedWork } from "@repo/sources";
import { eq } from "drizzle-orm";
import pino from "pino";
import { afterAll, describe, expect, it } from "vitest";
import { createWorkerDb } from "../db.js";
import { createObjectStore } from "../object-store.js";
import { runReaderBuild } from "./reader-build.js";

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

function testEnv(): WorkerEnv {
  return {
    NODE_ENV: "test",
    DATABASE_URL: process.env.DATABASE_URL ?? "postgres://pi:pi_dev_password@localhost:5432/pi_dev",
    ARXIV_CONTACT_EMAIL: "test@example.com",
    HARVEST_CATEGORIES: ["cs.RO"],
    HARVEST_CRON: "0 3 * * *",
    HARVEST_CRON_TZ: "UTC",
    HARVEST_BULK_WINDOW_MONTHS: 6,
    OBJECT_STORAGE_BUCKET: process.env.OBJECT_STORAGE_BUCKET ?? "pi-dev",
    OBJECT_STORAGE_REGION: "us-east-1",
    OBJECT_STORAGE_ENDPOINT: process.env.OBJECT_STORAGE_ENDPOINT ?? "http://localhost:8333",
    OBJECT_STORAGE_ACCESS_KEY_ID: process.env.OBJECT_STORAGE_ACCESS_KEY_ID ?? "pi_dev_access_key",
    OBJECT_STORAGE_SECRET_ACCESS_KEY:
      process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY ?? "pi_dev_secret_key_change_me",
    READER_PIPELINE_VERSION: 1,
  };
}

const db = createWorkerDb(testEnv());
const logger = pino({ enabled: false });

function testWork(overrides: Partial<NormalizedWork> = {}): NormalizedWork {
  return {
    title: "Attention Is All You Need (test fixture)",
    abstract: "Test abstract.",
    language: null,
    workType: "preprint",
    publishedAt: new Date("2017-06-12"),
    identifiers: [
      {
        scheme: "arxiv",
        valueNormalized: "1706.03762-reader-test",
        valueRaw: "1706.03762-reader-test",
      },
    ],
    authors: [{ name: "Ashish Vaswani", position: 1 }],
    categories: ["cs.CL"],
    version: {
      source: "arxiv",
      versionLabel: "v1",
      publishedAt: new Date("2017-06-12"),
      license: "http://creativecommons.org/licenses/by/4.0/",
      licenseUrl: "http://creativecommons.org/licenses/by/4.0/",
      pdfUrl: null,
      htmlUrl: null,
      sourceUrl: null,
    },
    ...overrides,
  };
}

async function setupWorkVersion(
  work: NormalizedWork,
): Promise<{ workId: string; workVersionId: string }> {
  const { workId } = await upsertNormalizedWork(db, work);
  const [version] = await db
    .select({ id: workVersions.id })
    .from(workVersions)
    .where(eq(workVersions.workId, workId))
    .limit(1);
  if (!version) throw new Error("expected a work_versions row after upsert");
  return { workId, workVersionId: version.id };
}

async function cleanup(workId: string): Promise<void> {
  const versions = await db
    .select({ id: workVersions.id })
    .from(workVersions)
    .where(eq(workVersions.workId, workId));
  for (const v of versions) {
    await db.delete(readerDocuments).where(eq(readerDocuments.workVersionId, v.id));
  }
  await db.delete(authorships).where(eq(authorships.workId, workId));
  await db.delete(workVersions).where(eq(workVersions.workId, workId));
  await db.delete(workIdentifiers).where(eq(workIdentifiers.workId, workId));
  await db.delete(works).where(eq(works.id, workId));
}

describe("runReaderBuild", () => {
  afterAll(async () => {
    await db.$client.end();
  });

  it("builds a reader document from a real arXiv HTML fixture and stores it in object storage", async () => {
    const { workId, workVersionId } = await setupWorkVersion(testWork());
    try {
      const outcome = await runReaderBuild(
        db,
        { workVersionId },
        testEnv(),
        logger,
        fixtureRouter({
          "1706.03762-reader-testv1": {
            status: 200,
            body: fixture("arxiv-html-1706.03762.html"),
          },
        }),
      );

      expect(outcome.status).toBe("built");
      if (outcome.status !== "built") throw new Error("unreachable");

      const [row] = await db
        .select()
        .from(readerDocuments)
        .where(eq(readerDocuments.workVersionId, workVersionId))
        .limit(1);
      if (!row) throw new Error("expected a reader_documents row after a successful build");
      expect(row.format).toBe("arxiv_html");
      expect(row.storageKey).toBe(outcome.storageKey);
      expect(Array.isArray(row.outline)).toBe(true);
      expect((row.outline as unknown[]).length).toBeGreaterThan(10);
      expect((row.figures as unknown[]).length).toBe(5);
      expect((row.references as unknown[]).length).toBe(40);
      expect(row.license).toBe("http://creativecommons.org/licenses/by/4.0/");

      const objectStore = createObjectStore(testEnv());
      const stored = await objectStore.get(outcome.storageKey);
      expect(stored).toContain("Introduction");
      expect(stored).not.toContain("<script");
    } finally {
      await cleanup(workId);
    }
  });

  it("is idempotent: rebuilding updates the existing row instead of duplicating it", async () => {
    const { workId, workVersionId } = await setupWorkVersion(testWork());
    try {
      const fetchImpl = fixtureRouter({
        "1706.03762-reader-testv1": { status: 200, body: fixture("arxiv-html-1706.03762.html") },
      });
      await runReaderBuild(db, { workVersionId }, testEnv(), logger, fetchImpl);
      await runReaderBuild(db, { workVersionId }, testEnv(), logger, fetchImpl);

      const rows = await db
        .select()
        .from(readerDocuments)
        .where(eq(readerDocuments.workVersionId, workVersionId));
      expect(rows).toHaveLength(1);
    } finally {
      await cleanup(workId);
    }
  });

  it("skips (without throwing) when arXiv has no HTML rendering for this version", async () => {
    const { workId, workVersionId } = await setupWorkVersion(testWork());
    try {
      const outcome = await runReaderBuild(
        db,
        { workVersionId },
        testEnv(),
        logger,
        fixtureRouter({ "1706.03762-reader-testv1": { status: 404, body: "" } }),
      );
      expect(outcome).toEqual({ status: "skipped", reason: expect.stringContaining("PDF-only") });

      const rows = await db
        .select()
        .from(readerDocuments)
        .where(eq(readerDocuments.workVersionId, workVersionId));
      expect(rows).toHaveLength(0);
    } finally {
      await cleanup(workId);
    }
  });

  it("skips non-arXiv sourced versions", async () => {
    const { workId, workVersionId } = await setupWorkVersion(
      testWork({
        identifiers: [
          {
            scheme: "doi",
            valueNormalized: "10.1234/reader-test-non-arxiv",
            valueRaw: "10.1234/reader-test-non-arxiv",
          },
        ],
        version: { ...testWork().version, source: "crossref" },
      }),
    );
    try {
      const outcome = await runReaderBuild(
        db,
        { workVersionId },
        testEnv(),
        logger,
        fixtureRouter({}),
      );
      expect(outcome).toEqual({
        status: "skipped",
        reason: expect.stringContaining("no HTML reader pipeline"),
      });
    } finally {
      await cleanup(workId);
    }
  });
});
