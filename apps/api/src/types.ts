import type { Logger } from "pino";
import type { Db } from "./db.js";

export interface AppEnv {
  Variables: {
    requestId: string;
    logger: Logger;
    db: Db;
  };
}
