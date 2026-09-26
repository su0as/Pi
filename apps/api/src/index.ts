import { loadApiEnv } from "@repo/config/env/api";
import { PgBoss } from "pg-boss";
import pino from "pino";
import { buildApp } from "./app.js";
import { createApiDb } from "./db.js";
import { ensureReaderBuildQueue } from "./lib/reader-queue.js";
import { createMailer } from "./mailer.js";
import { serve } from "./serve.js";

const env = loadApiEnv();
const logger = pino({
  transport: env.NODE_ENV === "development" ? { target: "pino-pretty" } : undefined,
});
const db = createApiDb(env);
const mailer = createMailer(env);

// Enqueue-only — apps/worker owns actually running "reader.build" (see routes/reader.ts).
const boss = new PgBoss(env.DATABASE_URL);
boss.on("error", (err) => logger.error({ err }, "pg-boss error (apps/api publisher)"));
await boss.start();
await ensureReaderBuildQueue(boss);

const app = buildApp({ env, db, logger, mailer, boss });

serve(app, env, logger);
