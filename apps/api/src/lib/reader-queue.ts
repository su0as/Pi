import type { PgBoss } from "pg-boss";

export const READER_BUILD_QUEUE = "reader.build";
const READER_BUILD_DEAD_LETTER_QUEUE = "reader.build.dlq";

// Mirrors apps/worker/src/queue.ts's RETRY_OPTIONS and queue names exactly — apps/api only ever
// sends to this queue (apps/worker owns running it), but pg-boss needs the queue itself to exist
// before `send()` will accept a job for it, and doesn't guarantee apps/worker boots first.
const RETRY_OPTIONS = {
  retryLimit: 5,
  retryBackoff: true,
  retryDelay: 30,
  retryDelayMax: 3600,
} as const;

/** Idempotent — safe to call on every apps/api boot even if apps/worker already created these. */
export async function ensureReaderBuildQueue(boss: PgBoss): Promise<void> {
  await boss.createQueue(READER_BUILD_DEAD_LETTER_QUEUE);
  await boss.createQueue(READER_BUILD_QUEUE, {
    ...RETRY_OPTIONS,
    deadLetter: READER_BUILD_DEAD_LETTER_QUEUE,
  });
}
