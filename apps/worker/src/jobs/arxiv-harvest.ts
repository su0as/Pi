import type { WorkerEnv } from "@repo/config/env/worker";
import { ingestionCheckpoints } from "@repo/db/schema";
import { upsertNormalizedWork } from "@repo/sources";
import { eq } from "drizzle-orm";
import type { PgBoss } from "pg-boss";
import type { Logger } from "pino";
import type { SourceConnectors } from "../connectors.js";
import type { Db } from "../db.js";
import { QUEUE_NAMES, RETRY_OPTIONS } from "../queue.js";

/**
 * docs/CONTEXT.md section 9.3 — "daily arxiv.harvest cron (configurable time) ... Configurable
 * 6-month bulk window." The bulk window only applies when there's no prior successful run on
 * record (`ingestion_checkpoints`); every run after that resumes from the previous run's start
 * time, so the window doesn't re-harvest the same months forever.
 */
export async function resolveSince(db: Db, env: WorkerEnv): Promise<Date> {
  const [checkpoint] = await db
    .select({ lastRunAt: ingestionCheckpoints.lastRunAt })
    .from(ingestionCheckpoints)
    .where(eq(ingestionCheckpoints.jobName, QUEUE_NAMES.arxivHarvest))
    .limit(1);
  if (checkpoint) return checkpoint.lastRunAt;

  const bulkWindowStart = new Date();
  bulkWindowStart.setUTCMonth(bulkWindowStart.getUTCMonth() - env.HARVEST_BULK_WINDOW_MONTHS);
  return bulkWindowStart;
}

async function recordCheckpoint(db: Db, runStartedAt: Date): Promise<void> {
  await db
    .insert(ingestionCheckpoints)
    .values({
      id: crypto.randomUUID(),
      jobName: QUEUE_NAMES.arxivHarvest,
      lastRunAt: runStartedAt,
    })
    .onConflictDoUpdate({
      target: ingestionCheckpoints.jobName,
      set: { lastRunAt: runStartedAt },
    });
}

export interface ArxivHarvestSummary {
  ingestedCount: number;
  enrichableCount: number;
}

/**
 * The actual harvest logic, independent of pg-boss's job/scheduling plumbing so it can be
 * exercised directly in tests against real Postgres and fixture-driven connectors, rather than
 * relying on pg-boss's polling loop to fire on a timer. `enqueueEnrich` is injected the same way
 * — `registerArxivHarvestJob` below wires it to a real `boss.send`.
 */
export async function runArxivHarvest(
  db: Db,
  connectors: SourceConnectors,
  env: WorkerEnv,
  logger: Logger,
  enqueueEnrich: (workId: string, doi: string) => Promise<void>,
): Promise<ArxivHarvestSummary> {
  const runStartedAt = new Date();
  const since = await resolveSince(db, env);
  logger.info(
    { since: since.toISOString(), categories: env.HARVEST_CATEGORIES },
    "arxiv.harvest: starting",
  );

  let ingestedCount = 0;
  let enrichableCount = 0;

  for (const category of env.HARVEST_CATEGORIES) {
    const iterable = connectors.arxiv.harvestIncremental?.(since, [category]);
    if (!iterable) continue;

    for await (const work of iterable) {
      const result = await upsertNormalizedWork(db, work);
      ingestedCount++;

      // "enrich arXiv works with OpenAlex IDs/ROR institutions/topics when available" — only
      // possible for works that already carry a DOI (from arXivRaw's optional <doi> field);
      // OpenAlex's fetchOpenAlexEnrichment resolves by DOI, not by arXiv id.
      const doi = work.identifiers.find((i) => i.scheme === "doi")?.valueNormalized;
      if (doi) {
        enrichableCount++;
        await enqueueEnrich(result.workId, doi);
      }
    }
  }

  await recordCheckpoint(db, runStartedAt);
  logger.info({ ingestedCount, enrichableCount }, "arxiv.harvest: completed");
  return { ingestedCount, enrichableCount };
}

export async function registerArxivHarvestJob(
  boss: PgBoss,
  db: Db,
  connectors: SourceConnectors,
  env: WorkerEnv,
  logger: Logger,
): Promise<void> {
  // The dead-letter queue must exist before a queue can name it as its `deadLetter` — pg-boss
  // validates the reference at creation time (verified directly: creating them in the other
  // order throws "Queue arxiv.harvest.dlq does not exist").
  await boss.createQueue(QUEUE_NAMES.arxivHarvestDeadLetter);
  await boss.createQueue(QUEUE_NAMES.arxivHarvest, {
    ...RETRY_OPTIONS,
    deadLetter: QUEUE_NAMES.arxivHarvestDeadLetter,
  });

  await boss.schedule(QUEUE_NAMES.arxivHarvest, env.HARVEST_CRON, {}, { tz: env.HARVEST_CRON_TZ });

  await boss.work(QUEUE_NAMES.arxivHarvest, async () => {
    // singletonKey (docs/CONTEXT.md's "idempotency keys"): re-harvesting the same work (e.g. a
    // version bump) won't queue a duplicate enrich job while one is still pending.
    const enqueueEnrich = async (workId: string, doi: string) => {
      await boss.send(QUEUE_NAMES.workEnrich, { workId, doi }, { singletonKey: workId });
    };
    await runArxivHarvest(db, connectors, env, logger, enqueueEnrich);
  });

  await boss.work(QUEUE_NAMES.arxivHarvestDeadLetter, async (jobs) => {
    for (const job of jobs) {
      logger.error(
        { deadLetteredJob: job },
        "arxiv.harvest: job dead-lettered after retries exhausted",
      );
    }
  });
}
