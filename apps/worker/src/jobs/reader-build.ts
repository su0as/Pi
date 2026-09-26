import { brand } from "@repo/config/brand";
import type { WorkerEnv } from "@repo/config/env/worker";
import { generateId } from "@repo/db/id";
import { readerDocuments, workIdentifiers, workVersions } from "@repo/db/schema";
import { normalizeArxivHtml } from "@repo/reader";
import { and, eq } from "drizzle-orm";
import type { PgBoss } from "pg-boss";
import type { Logger } from "pino";
import type { Db } from "../db.js";
import { createObjectStore } from "../object-store.js";
import { QUEUE_NAMES, RETRY_OPTIONS } from "../queue.js";

export interface ReaderBuildJobData {
  workVersionId: string;
}

function isReaderBuildJobData(data: unknown): data is ReaderBuildJobData {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof (data as ReaderBuildJobData).workVersionId === "string"
  );
}

export type ReaderBuildOutcome =
  | { status: "built"; storageKey: string }
  | { status: "skipped"; reason: string };

/**
 * docs/CONTEXT.md section 10 — "Fetch arXiv HTML when available; sanitize ... normalize ... Store
 * in object storage keyed by pipeline_version; reader_documents row tracks status." Only
 * arXiv-sourced versions are built here — non-arXiv sources and the PDF-fallback path are an
 * explicit known gap for this milestone (CONTEXT.md's own "review against source terms before
 * scaling" note for PDF proxying), same scoping pattern as ADR-0007's M3 deferrals.
 *
 * Independent of pg-boss's job plumbing for the same testability reason as arxiv-harvest.ts's
 * runArxivHarvest and work-enrich.ts's runWorkEnrich.
 */
export async function runReaderBuild(
  db: Db,
  data: ReaderBuildJobData,
  env: WorkerEnv,
  logger: Logger,
  fetchImpl: typeof fetch = fetch,
): Promise<ReaderBuildOutcome> {
  const { workVersionId } = data;

  const [version] = await db
    .select()
    .from(workVersions)
    .where(eq(workVersions.id, workVersionId))
    .limit(1);
  if (!version) {
    throw new Error(`reader.build: no work_versions row for id ${workVersionId}`);
  }

  if (version.source !== "arxiv") {
    const reason = `source "${version.source}" has no HTML reader pipeline yet (arXiv-only for now)`;
    logger.info({ workVersionId, source: version.source }, `reader.build: skipped — ${reason}`);
    return { status: "skipped", reason };
  }

  const [identifier] = await db
    .select({ arxivId: workIdentifiers.valueNormalized })
    .from(workIdentifiers)
    .where(and(eq(workIdentifiers.workId, version.workId), eq(workIdentifiers.scheme, "arxiv")))
    .limit(1);
  if (!identifier) {
    const reason = "no arxiv-scheme identifier on this work";
    logger.warn({ workVersionId }, `reader.build: skipped — ${reason}`);
    return { status: "skipped", reason };
  }

  const url = `https://arxiv.org/html/${identifier.arxivId}${version.versionLabel}`;
  const userAgent = `${brand.shortName} (mailto:${env.ARXIV_CONTACT_EMAIL})`;
  const res = await fetchImpl(url, { headers: { "User-Agent": userAgent } });

  if (res.status === 404) {
    // "PDF fallback ... not fully built if it risks scope creep" — CONTEXT.md's own explicit
    // permission to defer. No reader_documents row is written; a later milestone's PDF-fallback
    // path is what serves this version until then.
    const reason = "arXiv has no HTML rendering for this version (PDF-only)";
    logger.info({ workVersionId, url }, `reader.build: skipped — ${reason}`);
    return { status: "skipped", reason };
  }
  if (!res.ok) {
    throw new Error(`reader.build: fetching ${url} failed: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  const document = normalizeArxivHtml(html, url);

  const storageKey = `reader-documents/${workVersionId}/v${env.READER_PIPELINE_VERSION}.html`;
  const objectStore = createObjectStore(env);
  await objectStore.put(storageKey, document.bodyHtml, "text/html; charset=utf-8");

  const values = {
    format: "arxiv_html" as const,
    storageKey,
    outline: document.outline,
    figures: document.figures,
    references: document.references,
    pipelineVersion: env.READER_PIPELINE_VERSION,
    license: version.license,
  };

  await db
    .insert(readerDocuments)
    .values({ id: generateId(), workVersionId, ...values })
    .onConflictDoUpdate({ target: readerDocuments.workVersionId, set: values });

  logger.info({ workVersionId, storageKey }, "reader.build: built");
  return { status: "built", storageKey };
}

export async function registerReaderBuildJob(
  boss: PgBoss,
  db: Db,
  env: WorkerEnv,
  logger: Logger,
  fetchImpl?: typeof fetch,
): Promise<void> {
  await boss.createQueue(QUEUE_NAMES.readerBuildDeadLetter);
  await boss.createQueue(QUEUE_NAMES.readerBuild, {
    ...RETRY_OPTIONS,
    deadLetter: QUEUE_NAMES.readerBuildDeadLetter,
  });

  await boss.work(QUEUE_NAMES.readerBuild, async ([job]) => {
    if (!job || !isReaderBuildJobData(job.data)) {
      throw new Error(`reader.build: malformed job data: ${JSON.stringify(job?.data)}`);
    }
    await runReaderBuild(db, job.data, env, logger, fetchImpl);
  });

  await boss.work(QUEUE_NAMES.readerBuildDeadLetter, async (jobs) => {
    for (const job of jobs) {
      logger.error(
        { deadLetteredJob: job },
        "reader.build: job dead-lettered after retries exhausted",
      );
    }
  });
}
