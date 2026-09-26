import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createdUpdatedAt, id } from "./_helpers.js";

/**
 * M4's `apps/worker` bookkeeping — not part of docs/CONTEXT.md section 6's domain model, since
 * it's operational cursor state (not user- or scholarly-domain data): "how far did the last
 * successful `arxiv.harvest` run get" so the next scheduled run knows where to resume instead of
 * re-harvesting the whole configurable bulk window every time.
 */
export const ingestionCheckpoints = pgTable(
  "ingestion_checkpoints",
  {
    id: id(),
    jobName: text().notNull(),
    lastRunAt: timestamp({ withTimezone: true }).notNull(),
    ...createdUpdatedAt,
  },
  (t) => [uniqueIndex("ingestion_checkpoints_job_name_idx").on(t.jobName)],
);
