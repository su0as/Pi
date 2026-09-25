import type { ApiEnv } from "@repo/config/env/api";
import { createDb } from "@repo/db/client";

export type Db = ReturnType<typeof createDb>;

export function createApiDb(env: ApiEnv): Db {
  return createDb(env.DATABASE_URL);
}
