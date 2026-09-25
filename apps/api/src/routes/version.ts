import { createRoute, z } from "@hono/zod-openapi";

const versionResponseSchema = z.object({
  name: z.string(),
  version: z.string(),
});

export const versionRoute = createRoute({
  method: "get",
  path: "/version",
  summary: "API name and version",
  responses: {
    200: {
      description: "OK",
      content: { "application/json": { schema: versionResponseSchema } },
    },
  },
});
