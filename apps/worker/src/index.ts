import { loadWorkerEnv } from "@repo/config/env/worker";
import pino from "pino";
import { buildSourceConnectors } from "./connectors.js";
import { createWorkerDb } from "./db.js";
import { registerArxivHarvestJob } from "./jobs/arxiv-harvest.js";
import { registerWorkEnrichJob } from "./jobs/work-enrich.js";
import { createBoss, startBoss } from "./queue.js";

const env = loadWorkerEnv();
const logger = pino({
  transport: env.NODE_ENV === "development" ? { target: "pino-pretty" } : undefined,
});

async function main() {
  const db = createWorkerDb(env);
  const connectors = buildSourceConnectors(env);
  const boss = createBoss(env);

  await startBoss(boss, logger);
  await registerArxivHarvestJob(boss, db, connectors, env, logger);
  await registerWorkEnrichJob(boss, db, env, logger);

  logger.info(
    {
      harvestCron: env.HARVEST_CRON,
      harvestTz: env.HARVEST_CRON_TZ,
      categories: env.HARVEST_CATEGORIES,
    },
    "@repo/worker booted: arxiv.harvest and work.enrich registered",
  );

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, async () => {
      logger.info({ signal }, "@repo/worker shutting down");
      await boss.stop();
      await db.$client.end();
      process.exit(0);
    });
  }
}

main().catch((err: unknown) => {
  logger.error({ err }, "@repo/worker failed to start");
  process.exit(1);
});
