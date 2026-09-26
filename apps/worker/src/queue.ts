import type { WorkerEnv } from "@repo/config/env/worker";
import { PgBoss } from "pg-boss";
import type { Logger } from "pino";

export const QUEUE_NAMES = {
  arxivHarvest: "arxiv.harvest",
  arxivHarvestDeadLetter: "arxiv.harvest.dlq",
  workEnrich: "work.enrich",
  workEnrichDeadLetter: "work.enrich.dlq",
} as const;

// docs/CONTEXT.md section 9.3 — "retries, dead-letter record." Two retries with exponential
// backoff before a job is copied into its queue's `deadLetter` queue by pg-boss itself; the
// `.dlq` queues below are worked separately just to turn that into a structured log line (see
// jobs/*.ts) — CONTEXT.md doesn't specify a dedicated DB table for this, and none of the M1-M4
// schema's domain tables are the right place for infra-level job-failure bookkeeping.
export const RETRY_OPTIONS = {
  retryLimit: 5,
  retryBackoff: true,
  retryDelay: 30,
  retryDelayMax: 3600,
} as const;

export function createBoss(env: WorkerEnv): PgBoss {
  return new PgBoss(env.DATABASE_URL);
}

export async function startBoss(boss: PgBoss, logger: Logger): Promise<void> {
  boss.on("error", (err) => logger.error({ err }, "pg-boss error"));
  await boss.start();
}
