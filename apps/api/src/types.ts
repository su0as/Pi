import type { Logger } from "pino";
import type { Db } from "./db.js";

export interface AppEnv {
  Variables: {
    requestId: string;
    logger: Logger;
    db: Db;
    /** Set by middleware/session-context.ts on every request; null when signed out. */
    userId: string | null;
  };
}
