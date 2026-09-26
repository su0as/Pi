import { loadApiEnv } from "@repo/config/env/api";
import pino from "pino";
import { buildApp } from "./app.js";
import { createApiDb } from "./db.js";
import { createMailer } from "./mailer.js";
import { serve } from "./serve.js";

const env = loadApiEnv();
const logger = pino({
  transport: env.NODE_ENV === "development" ? { target: "pino-pretty" } : undefined,
});
const db = createApiDb(env);
const mailer = createMailer(env);

const app = buildApp({ env, db, logger, mailer });

serve(app, env, logger);
