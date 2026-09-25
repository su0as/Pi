import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { AppError } from "../lib/problem-details.js";
import { json } from "../test-utils.js";
import type { AppEnv } from "../types.js";
import { notFound, onError, validationHook } from "./error-handler.js";

describe("validationHook", () => {
  const route = createRoute({
    method: "get",
    path: "/echo",
    request: { query: z.object({ n: z.coerce.number() }) },
    responses: {
      200: {
        description: "ok",
        content: { "application/json": { schema: z.object({ n: z.number() }) } },
      },
    },
  });

  function buildApp() {
    const app = new OpenAPIHono<AppEnv>({ defaultHook: validationHook });
    app.openapi(route, (c) => c.json({ n: c.req.valid("query").n }, 200));
    return app;
  }

  it("passes valid input through to the handler", async () => {
    const app = buildApp();
    const res = await app.request("/echo?n=5");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ n: 5 });
  });

  it("returns RFC 9457 problem+json for invalid input", async () => {
    const app = buildApp();
    const res = await app.request("/echo?n=not-a-number");
    expect(res.status).toBe(400);
    const body = await json<{ status: number; code: string; issues: unknown }>(res);
    expect(body).toMatchObject({ status: 400, code: "validation_error" });
    expect(Array.isArray(body.issues)).toBe(true);
  });
});

describe("onError", () => {
  function buildApp() {
    const app = new Hono<AppEnv>();
    app.onError(onError);
    app.get("/app-error", () => {
      throw new AppError(409, "conflict", "That already exists.");
    });
    app.get("/unexpected", () => {
      throw new Error("boom");
    });
    return app;
  }

  it("maps AppError to its own status and code", async () => {
    const app = buildApp();
    const res = await app.request("/app-error");
    expect(res.status).toBe(409);
    const body = await json<{ status: number; code: string; detail: string; requestId: string }>(
      res,
    );
    expect(body).toMatchObject({ status: 409, code: "conflict", detail: "That already exists." });
    expect(body.requestId).toBeTruthy();
  });

  it("maps an unexpected error to a generic 500 without leaking its message", async () => {
    const app = buildApp();
    const res = await app.request("/unexpected");
    expect(res.status).toBe(500);
    const body = await json<{ code: string; detail?: string }>(res);
    expect(body.code).toBe("internal_error");
    expect(body.detail).toBeUndefined();
  });
});

describe("notFound", () => {
  it("returns RFC 9457 problem+json", async () => {
    const app = new Hono<AppEnv>();
    app.notFound(notFound);
    const res = await app.request("/nope");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toMatchObject({ status: 404, code: "not_found" });
  });
});
