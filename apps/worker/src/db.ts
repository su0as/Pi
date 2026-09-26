import type { WorkerEnv } from "@repo/config/env/worker";
import { createDb } from "@repo/db/client";

export type Db = ReturnType<typeof createDb>;

export function createWorkerDb(env: WorkerEnv): Db {
  return createDb(env.DATABASE_URL);
}
