import { writeFileSync } from "node:fs";
import { OpenAPIHono } from "@hono/zod-openapi";
import { brand } from "@repo/config/brand";
import { validationHook } from "./middleware/error-handler.js";
import { healthRoute } from "./routes/health.js";
import { versionRoute } from "./routes/version.js";
import type { AppEnv } from "./types.js";

// Builds the same route registry as buildApp() (src/app.ts) but without any middleware, DB
// connection, or running server — just enough to generate the OpenAPI document. Keeping the
// route *definitions* (health.ts, version.ts) shared between this and app.ts is what keeps the
// spec in sync with the real API; only the middleware/wiring is duplicated here, deliberately,
// since a spec generator has no business opening a DB connection.
function buildSpecOnlyApp() {
  const v1 = new OpenAPIHono<AppEnv>({ defaultHook: validationHook });
  v1.openapi(healthRoute, (c) => c.json({ status: "ok" as const, database: "ok" as const }, 200));
  v1.openapi(versionRoute, (c) => c.json({ name: brand.shortName, version: "0.0.0" }, 200));

  const app = new OpenAPIHono<AppEnv>();
  app.route("/v1", v1);
  return app;
}

const app = buildSpecOnlyApp();
const document = app.getOpenAPI31Document({
  openapi: "3.1.0",
  info: { title: `${brand.name} API`, version: "0.0.0" },
  servers: [{ url: "/v1" }],
});

writeFileSync(
  new URL("../openapi.json", import.meta.url),
  `${JSON.stringify(document, null, 2)}\n`,
);

console.info("Wrote apps/api/openapi.json");
