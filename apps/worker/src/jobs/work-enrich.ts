import { brand } from "@repo/config/brand";
import type { WorkerEnv } from "@repo/config/env/worker";
import {
  applyOpenAlexEnrichment,
  fetchOpenAlexEnrichment,
  type OpenAlexConnectorConfig,
} from "@repo/sources";
import type { PgBoss } from "pg-boss";
import type { Logger } from "pino";
import type { Db } from "../db.js";
import { QUEUE_NAMES, RETRY_OPTIONS } from "../queue.js";

export interface WorkEnrichJobData {
  workId: string;
  doi: string;
}

function isWorkEnrichJobData(data: unknown): data is WorkEnrichJobData {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof (data as WorkEnrichJobData).workId === "string" &&
    typeof (data as WorkEnrichJobData).doi === "string"
  );
}

/**
 * docs/CONTEXT.md section 9.3 — "work.enrich job." Applies OpenAlex's institutions/ROR/topics
 * data to an already-ingested work (packages/sources' applyOpenAlexEnrichment). Independent of
 * pg-boss's job plumbing for the same testability reason as arxiv-harvest.ts's runArxivHarvest.
 */
export async function runWorkEnrich(
  db: Db,
  data: WorkEnrichJobData,
  config: OpenAlexConnectorConfig,
  logger: Logger,
): Promise<void> {
  const { workId, doi } = data;

  const enrichment = await fetchOpenAlexEnrichment(doi, config);
  if (!enrichment) {
    logger.info({ workId, doi }, "work.enrich: OpenAlex has no record of this DOI");
    return;
  }

  await applyOpenAlexEnrichment(db, workId, enrichment);
  logger.info(
    {
      workId,
      doi,
      topicCount: enrichment.topics.length,
      institutionCount: enrichment.institutions.length,
    },
    "work.enrich: applied",
  );
}

export function buildOpenAlexEnrichmentConfig(
  env: WorkerEnv,
  fetchImpl?: typeof fetch,
): OpenAlexConnectorConfig {
  return { contactEmail: env.ARXIV_CONTACT_EMAIL, productName: brand.shortName, fetchImpl };
}

export async function registerWorkEnrichJob(
  boss: PgBoss,
  db: Db,
  env: WorkerEnv,
  logger: Logger,
  fetchImpl?: typeof fetch,
): Promise<void> {
  const config = buildOpenAlexEnrichmentConfig(env, fetchImpl);

  // Dead-letter queue must exist first — see the matching comment in arxiv-harvest.ts.
  await boss.createQueue(QUEUE_NAMES.workEnrichDeadLetter);
  await boss.createQueue(QUEUE_NAMES.workEnrich, {
    ...RETRY_OPTIONS,
    deadLetter: QUEUE_NAMES.workEnrichDeadLetter,
  });

  await boss.work(QUEUE_NAMES.workEnrich, async ([job]) => {
    if (!job || !isWorkEnrichJobData(job.data)) {
      throw new Error(`work.enrich: malformed job data: ${JSON.stringify(job?.data)}`);
    }
    await runWorkEnrich(db, job.data, config, logger);
  });

  await boss.work(QUEUE_NAMES.workEnrichDeadLetter, async (jobs) => {
    for (const job of jobs) {
      logger.error(
        { deadLetteredJob: job },
        "work.enrich: job dead-lettered after retries exhausted",
      );
    }
  });
}
