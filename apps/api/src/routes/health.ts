import { createRoute, z } from "@hono/zod-openapi";

const healthResponseSchema = z.object({
  status: z.enum(["ok", "error"]),
  database: z.enum(["ok", "unreachable"]),
});

export const healthRoute = createRoute({
  method: "get",
  path: "/health",
  summary: "Liveness and DB-connectivity check",
  responses: {
    200: {
      description: "Healthy",
      content: { "application/json": { schema: healthResponseSchema } },
    },
    503: {
      description: "Database unreachable",
      content: { "application/json": { schema: healthResponseSchema } },
    },
  },
});
