import { isAdmin, isModerator } from "@repo/core";
import { users } from "@repo/db/schema";
import { eq } from "drizzle-orm";
import type { MiddlewareHandler } from "hono";
import { AppError } from "../lib/problem-details.js";
import type { AppEnv } from "../types.js";

/** Gates a route to signed-in requests — relies on `sessionContext` (mounted globally in
 * app.ts) having already populated `c.get("userId")`. */
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get("userId")) {
    throw new AppError(401, "unauthenticated", "Sign in required.");
  }
  await next();
};

/** Role isn't on the better-auth session (packages/core's role check needs `users.role`, which
 * isn't one of the fields better-auth's session object carries — see apps/api/src/auth.ts's
 * comment on why `role`/`status`/etc. aren't declared as additionalFields), so this queries it
 * directly. Compose after `requireAuth`, not instead of it. */
export function requireRole(kind: "moderator" | "admin"): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const userId = c.get("userId");
    if (!userId) {
      throw new AppError(401, "unauthenticated", "Sign in required.");
    }

    const db = c.get("db");
    const [row] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!row) {
      throw new AppError(401, "unauthenticated", "Sign in required.");
    }

    const allowed = kind === "admin" ? isAdmin(row.role) : isModerator(row.role);
    if (!allowed) {
      throw new AppError(403, "forbidden", `This action requires the ${kind} role.`);
    }

    await next();
  };
}
