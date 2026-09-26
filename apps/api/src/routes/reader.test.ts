import { loadApiEnv } from "@repo/config/env/api";
import { generateId } from "@repo/db/id";
import {
  authorships,
  readerDocuments,
  workIdentifiers,
  works,
  workVersions,
} from "@repo/db/schema";
import { createS3ObjectStore } from "@repo/reader";
import { type NormalizedWork, upsertNormalizedWork } from "@repo/sources";
import { eq } from "drizzle-orm";
import { PgBoss } from "pg-boss";
import pino from "pino";
import { afterAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { createApiDb } from "../db.js";
import { ensureReaderBuildQueue } from "../lib/reader-queue.js";
import { createMailer } from "../mailer.js";
import { json } from "../test-utils.js";

const env = loadApiEnv();
const db = createApiDb(env);
const logger = pino({ enabled: false });
const mailer = createMailer(env);
const objectStore = createS3ObjectStore({
  bucket: env.OBJECT_STORAGE_BUCKET,
  region: env.OBJECT_STORAGE_REGION,
  endpoint: env.OBJECT_STORAGE_ENDPOINT,
  accessKeyId: env.OBJECT_STORAGE_ACCESS_KEY_ID,
  secretAccessKey: env.OBJECT_STORAGE_SECRET_ACCESS_KEY,
});

function testWork(arxivId: string): NormalizedWork {
  return {
    title: "Reader route test work",
    abstract: null,
    language: null,
    workType: "preprint",
    publishedAt: new Date("2020-01-01"),
    identifiers: [{ scheme: "arxiv", valueNormalized: arxivId, valueRaw: arxivId }],
    authors: [{ name: "Test Author", position: 1 }],
    categories: [],
    version: {
      source: "arxiv",
      versionLabel: "v1",
      publishedAt: new Date("2020-01-01"),
      license: null,
      licenseUrl: null,
      pdfUrl: null,
      htmlUrl: null,
      sourceUrl: null,
    },
  };
}

async function cleanupWork(workId: string): Promise<void> {
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

describe("GET /v1/works/:workId/reader", () => {
  afterAll(async () => {
    await db.$client.end();
  });

  it("returns 404 for a work with no versions on file", async () => {
    const app = buildApp({ env, db, logger, mailer });
    const workId = generateId();
    await db
      .insert(works)
      .values({ id: workId, title: "Versionless work", workType: "preprint", citationCount: 0 });
    try {
      const res = await app.request(`/v1/works/${workId}/reader`);
      expect(res.status).toBe(404);
    } finally {
      await db.delete(works).where(eq(works.id, workId));
    }
  });

  it("returns 200 with the stored document when a reader_documents row already exists", async () => {
    const app = buildApp({ env, db, logger, mailer });
    const { workId } = await upsertNormalizedWork(db, testWork("reader-route-test-ready"));
    const [version] = await db
      .select({ id: workVersions.id })
      .from(workVersions)
      .where(eq(workVersions.workId, workId))
      .limit(1);
    if (!version) throw new Error("expected a work_versions row");

    const storageKey = `reader-documents/${version.id}/v1.html`;
    await objectStore.put(storageKey, "<p>Hello reader</p>", "text/html; charset=utf-8");
    await db.insert(readerDocuments).values({
      id: generateId(),
      workVersionId: version.id,
      format: "arxiv_html",
      storageKey,
      outline: [{ id: "S1", level: 1, title: "Intro" }],
      figures: [],
      references: [],
      pipelineVersion: 1,
    });

    try {
      const res = await app.request(`/v1/works/${workId}/reader`);
      expect(res.status).toBe(200);
      const body = await json<{ status: string; bodyHtml: string; outline: unknown[] }>(res);
      expect(body.status).toBe("ready");
      expect(body.bodyHtml).toBe("<p>Hello reader</p>");
      expect(body.outline).toHaveLength(1);
    } finally {
      await cleanupWork(workId);
    }
  });

  it("returns 202 and enqueues a reader.build job when no reader document exists yet", async () => {
    const boss = new PgBoss(env.DATABASE_URL);
    await boss.start();
    await ensureReaderBuildQueue(boss);
    const app = buildApp({ env, db, logger, mailer, boss });
    const { workId } = await upsertNormalizedWork(db, testWork("reader-route-test-pending"));
    const [version] = await db
      .select({ id: workVersions.id })
      .from(workVersions)
      .where(eq(workVersions.workId, workId))
      .limit(1);
    if (!version) throw new Error("expected a work_versions row");

    try {
      const res = await app.request(`/v1/works/${workId}/reader`);
      expect(res.status).toBe(202);
      const body = await json<{ status: string }>(res);
      expect(body.status).toBe("pending");

      // getQueue()'s counts are refreshed on a maintenance interval, not synchronously on send()
      // — findJobs() reads the actual job row directly, keyed by the singletonKey we sent with.
      const queuedJobs = await boss.findJobs("reader.build", { key: version.id });
      expect(queuedJobs.length).toBeGreaterThan(0);
    } finally {
      await boss.deleteQueuedJobs("reader.build").catch(() => {});
      await boss.stop({ graceful: false });
      await cleanupWork(workId);
    }
  });
});
