import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { generateId } from "@repo/core";
import { blocks, reports } from "@repo/db/schema";
import { and, eq } from "drizzle-orm";
import { AppError } from "../lib/problem-details.js";
import { validationHook } from "../middleware/error-handler.js";
import { requireAuth } from "../middleware/require-auth.js";
import type { AppEnv } from "../types.js";

const reportInputSchema = z.object({
  targetType: z.enum(["note", "user", "profile"]),
  targetId: z.string().uuid(),
  reason: z.string().min(1).max(500),
  details: z.string().max(2000).optional(),
});

const reportRoute = createRoute({
  method: "post",
  path: "/",
  request: { body: { content: { "application/json": { schema: reportInputSchema } } } },
  responses: {
    201: {
      description: "Report filed",
      content: { "application/json": { schema: z.object({ id: z.string().uuid() }) } },
    },
  },
});

/** docs/CONTEXT.md section 7 — "Report ... on every note and profile." Mounted at `/v1/reports` in
 * app.ts — its own dedicated prefix, deliberately not the v1 root: a router's `use("*", ...)`
 * middleware matches everything under wherever it's mounted, so mounting an auth-gated router at
 * the v1 root would shadow every *other* v1 route with `requireAuth` too (caught by app.test.ts
 * failing on /v1/health and /v1/openapi.json after a first, wrong attempt at this — verified
 * directly, not assumed). */
export function buildReportsRoutes() {
  const router = new OpenAPIHono<AppEnv>({ defaultHook: validationHook });
  router.use("*", requireAuth);

  router.openapi(reportRoute, async (c) => {
    const userId = c.get("userId") as string;
    const db = c.get("db");
    const { targetType, targetId, reason, details } = c.req.valid("json");

    const id = generateId();
    await db
      .insert(reports)
      .values({ id, reporterId: userId, targetType, targetId, reason, details });
    return c.json({ id }, 201);
  });

  return router;
}

const blockRoute = createRoute({
  method: "post",
  path: "/{userId}/block",
  request: { params: z.object({ userId: z.string().uuid() }) },
  responses: {
    204: { description: "Blocked" },
    400: {
      description: "Can't block yourself",
      content: { "application/json": { schema: z.any() } },
    },
  },
});

const unblockRoute = createRoute({
  method: "delete",
  path: "/{userId}/block",
  request: { params: z.object({ userId: z.string().uuid() }) },
  responses: { 204: { description: "Unblocked" } },
});

/** docs/CONTEXT.md section 7 — "block on every ... profile." Mounted at `/v1/users` in app.ts —
 * see buildReportsRoutes' doc comment for why this needs its own prefix rather than the v1 root. */
export function buildBlockRoutes() {
  const router = new OpenAPIHono<AppEnv>({ defaultHook: validationHook });
  router.use("*", requireAuth);

  router.openapi(blockRoute, async (c) => {
    const { userId: blockedId } = c.req.valid("param");
    const blockerId = c.get("userId") as string;
    if (blockerId === blockedId) {
      throw new AppError(400, "cannot_block_self", "You can't block yourself.");
    }

    const db = c.get("db");
    await db.insert(blocks).values({ blockerId, blockedId }).onConflictDoNothing();
    return c.body(null, 204);
  });

  router.openapi(unblockRoute, async (c) => {
    const { userId: blockedId } = c.req.valid("param");
    const blockerId = c.get("userId") as string;

    const db = c.get("db");
    await db
      .delete(blocks)
      .where(and(eq(blocks.blockerId, blockerId), eq(blocks.blockedId, blockedId)));
    return c.body(null, 204);
  });

  return router;
}
