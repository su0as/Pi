import { loadApiEnv } from "@repo/config/env/api";
import { Hono } from "hono";
import { afterAll, describe, expect, it } from "vitest";
import { createApiDb } from "../db.js";
import type { AppEnv } from "../types.js";
import { onError } from "./error-handler.js";
import { createPostgresRateLimitStore, rateLimit } from "./rate-limit.js";

describe("rateLimit", () => {
  const env = loadApiEnv();
  const db = createApiDb(env);

  afterAll(async () => {
    await db.$client.end();
  });

  function buildTestApp(maxRequests: number) {
    const app = new Hono<AppEnv>();
    app.onError(onError);
    const store = createPostgresRateLimitStore(db);
    app.use(rateLimit(store, { ...env, RATE_LIMIT_MAX_REQUESTS: maxRequests }));
    app.get("/", (c) => c.json({ ok: true }));
    return app;
  }

  it("allows requests under the limit", async () => {
    const app = buildTestApp(5);
    const ip = `test-${crypto.randomUUID()}`;
    const res = await app.request("/", { headers: { "x-forwarded-for": ip } });
    expect(res.status).toBe(200);
  });

  it("rejects requests once the per-window limit is exceeded, with Retry-After", async () => {
    const app = buildTestApp(2);
    const ip = `test-${crypto.randomUUID()}`;
    const headers = { "x-forwarded-for": ip };

    const first = await app.request("/", { headers });
    const second = await app.request("/", { headers });
    const third = await app.request("/", { headers });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
    expect(third.headers.get("retry-after")).toBeTruthy();
  });

  it("keys different callers independently", async () => {
    const app = buildTestApp(1);
    const ipA = `test-${crypto.randomUUID()}`;
    const ipB = `test-${crypto.randomUUID()}`;

    const a1 = await app.request("/", { headers: { "x-forwarded-for": ipA } });
    const b1 = await app.request("/", { headers: { "x-forwarded-for": ipB } });

    expect(a1.status).toBe(200);
    expect(b1.status).toBe(200);
  });
});
