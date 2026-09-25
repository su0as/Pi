import { getConnInfo } from "@hono/node-server/conninfo";
import type { ApiEnv } from "@repo/config/env/api";
import { rateLimitBuckets } from "@repo/db/schema";
import { sql } from "drizzle-orm";
import type { MiddlewareHandler } from "hono";
import { AppError } from "../lib/problem-details.js";
import type { AppEnv } from "../types.js";

/**
 * Fixed-window rate limiting, Postgres-backed — CLAUDE.md: "Rate limits per user and per IP."
 * Per-user keying lands once auth exists (M3); this is IP-based for now, which is what M2 has to
 * work with. `docs/CONTEXT.md` calls the store "pluggable" — swapping the backing store later
 * (e.g. Redis) only means writing a different `RateLimitStore`, not touching this middleware.
 */
export interface RateLimitStore {
  /** Increments the bucket for `key`, resetting it if the window has rolled over. Returns the
   * request count so far in the current window. */
  hit(key: string, windowMs: number): Promise<number>;
}

export function createPostgresRateLimitStore(db: AppEnv["Variables"]["db"]): RateLimitStore {
  return {
    async hit(key, windowMs) {
      const now = new Date();
      const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);

      const [row] = await db
        .insert(rateLimitBuckets)
        .values({ key, windowStart, count: 1 })
        .onConflictDoUpdate({
          target: rateLimitBuckets.key,
          set: {
            count: sql`CASE WHEN ${rateLimitBuckets.windowStart} = ${windowStart.toISOString()}::timestamptz
                         THEN ${rateLimitBuckets.count} + 1
                         ELSE 1
                       END`,
            windowStart: sql`CASE WHEN ${rateLimitBuckets.windowStart} = ${windowStart.toISOString()}::timestamptz
                                THEN ${rateLimitBuckets.windowStart}
                                ELSE ${windowStart.toISOString()}::timestamptz
                              END`,
          },
        })
        .returning({ count: rateLimitBuckets.count });

      return row?.count ?? 1;
    },
  };
}

/**
 * `X-Forwarded-For`'s first entry is trusted here on the assumption that apps/api is never
 * directly internet-facing — CLAUDE.md's hosting options (Railway/Fly/Render/Hetzner as Docker
 * containers) all put a platform edge in front that sets this header itself. If apps/api is ever
 * deployed such that arbitrary clients can reach it directly, this becomes spoofable and needs
 * revisiting (M10 hardening) — falling back to the raw socket address (`getConnInfo`) alone would
 * be wrong in the opposite direction, since it'd see only the proxy's IP for every client.
 */
function clientIp(c: Parameters<MiddlewareHandler>[0]): string {
  const forwardedFor = c.req.header("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  try {
    return getConnInfo(c).remote.address ?? "unknown";
  } catch {
    return "unknown";
  }
}

export function rateLimit(store: RateLimitStore, env: ApiEnv): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const key = `ip:${clientIp(c)}`;
    const count = await store.hit(key, env.RATE_LIMIT_WINDOW_MS);

    if (count > env.RATE_LIMIT_MAX_REQUESTS) {
      const retryAfterSeconds = Math.ceil(env.RATE_LIMIT_WINDOW_MS / 1000);
      c.header("Retry-After", String(retryAfterSeconds));
      throw new AppError(429, "rate_limited", "Too many requests — try again shortly.");
    }

    await next();
  };
}
