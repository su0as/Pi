import { loadApiEnv } from "@repo/config/env/api";
import pino from "pino";
import { afterAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { createApiDb } from "./db.js";
import { createMailer } from "./mailer.js";
import { json } from "./test-utils.js";

describe("app", () => {
  const env = loadApiEnv();
  const db = createApiDb(env);
  const logger = pino({ enabled: false });
  const mailer = createMailer(env);
  const app = buildApp({ env, db, logger, mailer });

  afterAll(async () => {
    await db.$client.end();
  });

  it("GET /v1/health returns ok with a real DB connection", async () => {
    const res = await app.request("/v1/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", database: "ok" });
  });

  it("GET /v1/version returns the api name and version", async () => {
    const res = await app.request("/v1/version");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("name");
    expect(body).toHaveProperty("version");
  });

  it("GET /v1/openapi.json serves a valid-looking OpenAPI 3.1 document", async () => {
    const res = await app.request("/v1/openapi.json");
    expect(res.status).toBe(200);
    const body = await json<{ openapi: string; paths: Record<string, unknown> }>(res);
    expect(body.openapi).toBe("3.1.0");
    expect(body.paths).toHaveProperty("/v1/health");
    expect(body.paths).toHaveProperty("/v1/version");
  });

  it("GET /v1/reference serves the Scalar UI outside production", async () => {
    const res = await app.request("/v1/reference");
    expect(res.status).toBe(200);
  });

  it("an unknown route returns an RFC 9457 problem+json 404", async () => {
    const res = await app.request("/v1/does-not-exist");
    expect(res.status).toBe(404);
    const body = await json<{ status: number; code: string; requestId: string }>(res);
    expect(body).toMatchObject({ status: 404, code: "not_found" });
    expect(body.requestId).toBeTruthy();
  });

  it("every response carries an X-Request-Id header", async () => {
    const res = await app.request("/v1/health");
    expect(res.headers.get("x-request-id")).toBeTruthy();
  });
});
