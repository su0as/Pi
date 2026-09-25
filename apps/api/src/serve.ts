import { serve as serveNode } from "@hono/node-server";
import type { ApiEnv } from "@pi/config/env/api";
import type { Hono } from "hono";
import type { Logger } from "pino";

export function serve(app: Hono, env: ApiEnv, logger: Logger): void {
  serveNode({ fetch: app.fetch, port: env.PORT }, (info) => {
    logger.info(`@pi/api listening on http://localhost:${info.port}`);
  });
}
