import type { MiddlewareHandler } from "hono";
import type { Auth } from "../auth.js";
import type { AppEnv } from "../types.js";

/** Populates `c.get("userId")` from the session (cookie or, via the bearer plugin, an
 * `Authorization: Bearer` header) on every request — never throws, since most routes (health,
 * version, and later public paper pages) don't require auth. `requireAuth` (same directory) is
 * what actually gates a route. */
export function sessionContext(auth: Auth): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    c.set("userId", session?.user.id ?? null);
    await next();
  };
}
