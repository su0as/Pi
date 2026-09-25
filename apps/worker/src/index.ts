import { loadWorkerEnv } from "@repo/config/env/worker";
import pino from "pino";

// Job registration (pg-boss cron + queues: arxiv.harvest, work.enrich, ...)
// lands in M4 — see docs/CONTEXT.md section 9 and PROMPT_01_WEB.md M4.

const env = loadWorkerEnv();
const logger = pino({
  transport: env.NODE_ENV === "development" ? { target: "pino-pretty" } : undefined,
});

logger.info("@repo/worker booted (no jobs registered yet)");
