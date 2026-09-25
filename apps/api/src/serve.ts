import { serve as serveNode } from "@hono/node-server";
import type { ApiEnv } from "@repo/config/env/api";
import type { Logger } from "pino";
import type { App } from "./app.js";

export function serve(app: App, env: ApiEnv, logger: Logger): void {
  serveNode({ fetch: app.fetch, port: env.PORT }, (info) => {
    logger.info(`@repo/api listening on http://localhost:${info.port}`);
  });
}
