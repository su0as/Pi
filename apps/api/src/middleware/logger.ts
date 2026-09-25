import type { MiddlewareHandler } from "hono";
import type { Logger } from "pino";
import type { AppEnv } from "../types.js";

/** pino JSON logs with request IDs — CLAUDE.md: "pino JSON logs with request IDs." Runs after
 * `requestId` middleware (needs `c.get("requestId")` already set) and before routes (so
 * `c.get("logger")` is available everywhere downstream, including the error handler). */
export function requestLogger(baseLogger: Logger): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const requestId = c.get("requestId");
    const logger = baseLogger.child({ requestId });
    c.set("logger", logger);

    const start = Date.now();
    await next();
    const durationMs = Date.now() - start;

    logger.info(
      { method: c.req.method, path: c.req.path, status: c.res.status, durationMs },
      "request",
    );
  };
}
