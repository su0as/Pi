import { loadApiEnv } from "@repo/config/env/api";
import { Hono } from "hono";
import { afterAll, describe, expect, it } from "vitest";
import { createApiDb } from "../db.js";
import { json } from "../test-utils.js";
import type { AppEnv } from "../types.js";
import { onError } from "./error-handler.js";
import { idempotency } from "./idempotency.js";

describe("idempotency", () => {
  const env = loadApiEnv();
  const db = createApiDb(env);

  afterAll(async () => {
    await db.$client.end();
  });

  function buildTestApp() {
    const app = new Hono<AppEnv>();
    app.onError(onError);
    app.use((c, next) => {
      c.set("db", db);
      return next();
    });
    app.use(idempotency(env));
    let callCount = 0;
    app.post("/things", async (c) => {
      callCount += 1;
      const body = await c.req.json();
      return c.json({ id: crypto.randomUUID(), callCount, echo: body }, 201);
    });
    return { app, getCallCount: () => callCount };
  }

  it("passes through untouched when no Idempotency-Key header is sent", async () => {
    const { app, getCallCount } = buildTestApp();
    const res = await app.request("/things", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "no key" }),
    });
    expect(res.status).toBe(201);
    expect(getCallCount()).toBe(1);
  });

  it("replays the stored response for a repeated key with the same body", async () => {
    const { app, getCallCount } = buildTestApp();
    const key = `test-${crypto.randomUUID()}`;
    const requestInit = {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": key },
      body: JSON.stringify({ title: "same body" }),
    };

    const first = await app.request("/things", requestInit);
    const second = await app.request("/things", requestInit);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(getCallCount()).toBe(1); // handler only actually ran once
    expect(second.headers.get("idempotency-replayed")).toBe("true");

    const firstBody = await first.json();
    const secondBody = await second.json();
    expect(secondBody).toEqual(firstBody); // same id, not a freshly generated one
  });

  it("rejects a repeated key sent with a different body", async () => {
    const { app } = buildTestApp();
    const key = `test-${crypto.randomUUID()}`;

    const first = await app.request("/things", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": key },
      body: JSON.stringify({ title: "original" }),
    });
    const second = await app.request("/things", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": key },
      body: JSON.stringify({ title: "different" }),
    });

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
    const body = await json<{ code: string }>(second);
    expect(body.code).toBe("idempotency_key_reused");
  });
});
