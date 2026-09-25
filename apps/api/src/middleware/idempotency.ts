import { createHash } from "node:crypto";
import type { ApiEnv } from "@repo/config/env/api";
import { idempotencyKeys } from "@repo/db/schema";
import { eq } from "drizzle-orm";
import type { MiddlewareHandler } from "hono";
import { AppError } from "../lib/problem-details.js";
import type { AppEnv } from "../types.js";

/**
 * Idempotency-Key handling for creating POSTs — CLAUDE.md: "Idempotency-Key header ... on all
 * creating POSTs (mobile retries, offline queue)." Opt-in: requests without the header pass
 * straight through. A replayed key with the *same* body returns the stored response without
 * re-running the handler; a replayed key with a *different* body is a client bug (409).
 *
 * No route uses this yet (the first creating POST lands M7) — verified in
 * idempotency.test.ts against a dedicated test-only route, same reasoning as pagination/etag.
 */
function hashBody(body: string): string {
  return createHash("sha256").update(body).digest("hex");
}

export function idempotency(env: ApiEnv): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const key = c.req.header("idempotency-key");
    if (!key) {
      await next();
      return;
    }

    const db = c.get("db");
    const rawBody = await c.req.text();
    const requestHash = hashBody(rawBody);

    const [existing] = await db
      .select()
      .from(idempotencyKeys)
      .where(eq(idempotencyKeys.key, key))
      .limit(1);

    if (existing && existing.expiresAt > new Date()) {
      if (existing.requestHash !== requestHash) {
        throw new AppError(
          409,
          "idempotency_key_reused",
          "This Idempotency-Key was already used with a different request body.",
        );
      }
      // Setting `c.res` outright (rather than building the response through `c`) replaces
      // whatever header buffer `c.header()` would have applied, so the replay header has to go
      // directly on this Response's own headers instead.
      c.res = Response.json(existing.responseBody, {
        status: existing.responseStatus,
        headers: { "Idempotency-Replayed": "true" },
      });
      return;
    }

    // c.req.text() above consumed the body stream; re-inject it so the handler can still parse
    // JSON via c.req.json().
    const request = new Request(c.req.raw, { body: rawBody || undefined });
    c.req.raw = request;

    await next();

    const status = c.res.status;
    // Only cache successful creations — an error response replaying verbatim would hide a
    // transient failure (e.g. a DB hiccup) from a legitimate retry.
    if (status >= 200 && status < 300) {
      const responseClone = c.res.clone();
      const responseBody = await responseClone.json().catch(() => null);

      await db
        .insert(idempotencyKeys)
        .values({
          key,
          method: c.req.method,
          path: c.req.path,
          requestHash,
          responseStatus: status,
          responseBody,
          expiresAt: new Date(Date.now() + env.IDEMPOTENCY_KEY_TTL_MS),
        })
        .onConflictDoNothing();
    }
  };
}
