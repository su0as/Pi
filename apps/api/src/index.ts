import { loadApiEnv } from "@pi/config/env/api";
import { Hono } from "hono";
import pino from "pino";
import { serve } from "./serve.js";

const env = loadApiEnv();
const logger = pino({
  transport: env.NODE_ENV === "development" ? { target: "pino-pretty" } : undefined,
});

const app = new Hono();

app.get("/", (c) => c.json({ ok: true, service: "@pi/api" }));

serve(app, env, logger);
