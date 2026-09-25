import { OpenAPIHono } from "@hono/zod-openapi";
import { brand } from "@repo/config/brand";
import type { ApiEnv } from "@repo/config/env/api";
import { apiReference } from "@scalar/hono-api-reference";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import type { Logger } from "pino";
import type { Db } from "./db.js";
import { notFound, onError, validationHook } from "./middleware/error-handler.js";
import { idempotency } from "./middleware/idempotency.js";
import { requestLogger } from "./middleware/logger.js";
import { createPostgresRateLimitStore, rateLimit } from "./middleware/rate-limit.js";
import { healthRoute } from "./routes/health.js";
import { versionRoute } from "./routes/version.js";
import type { AppEnv } from "./types.js";

export interface BuildAppOptions {
  env: ApiEnv;
  db: Db;
  logger: Logger;
}

export function buildApp({ env, db, logger }: BuildAppOptions) {
  const app = new OpenAPIHono<AppEnv>({ defaultHook: validationHook });

  app.use(requestId());
  app.use(requestLogger(logger));
  app.use((c, next) => {
    c.set("db", db);
    return next();
  });
  app.use(
    cors({
      origin: env.CORS_ALLOWED_ORIGINS,
      credentials: true,
    }),
  );
  app.use(secureHeaders());

  const rateLimitStore = createPostgresRateLimitStore(db);
  app.use(rateLimit(rateLimitStore, env));
  app.use(idempotency(env));

  app.onError(onError);
  app.notFound(notFound);

  const v1 = new OpenAPIHono<AppEnv>({ defaultHook: validationHook });
  v1.openapi(healthRoute, async (c) => {
    const db = c.get("db");
    try {
      await db.execute("select 1");
    } catch (err) {
      c.get("logger")?.error({ err }, "health check: database unreachable");
      return c.json({ status: "error" as const, database: "unreachable" as const }, 503);
    }
    return c.json({ status: "ok" as const, database: "ok" as const }, 200);
  });
  v1.openapi(versionRoute, (c) => {
    return c.json(
      { name: brand.shortName, version: process.env.npm_package_version ?? "0.0.0" },
      200,
    );
  });

  app.route("/v1", v1);

  app.doc31("/v1/openapi.json", {
    openapi: "3.1.0",
    info: { title: `${brand.name} API`, version: "0.0.0" },
    servers: [{ url: "/v1" }],
  });

  if (env.NODE_ENV !== "production") {
    app.get(
      "/v1/reference",
      apiReference({
        url: "/v1/openapi.json",
        theme: "purple",
      }),
    );
  }

  return app;
}

export type App = ReturnType<typeof buildApp>;
