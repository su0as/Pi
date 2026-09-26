import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { readerDocuments, workVersions } from "@repo/db/schema";
import type { ObjectStore } from "@repo/reader";
import { desc, eq } from "drizzle-orm";
import type { PgBoss } from "pg-boss";
import { AppError } from "../lib/problem-details.js";
import { READER_BUILD_QUEUE } from "../lib/reader-queue.js";
import { validationHook } from "../middleware/error-handler.js";
import type { AppEnv } from "../types.js";

const readerResponseSchema = z.object({
  status: z.enum(["ready", "pending"]),
  bodyHtml: z.string().optional(),
  outline: z.array(z.unknown()).optional(),
  figures: z.array(z.unknown()).optional(),
  references: z.array(z.unknown()).optional(),
});

const readerRoute = createRoute({
  method: "get",
  path: "/{workId}/reader",
  summary: "Fetch the sanitized reader document for a work's latest version",
  request: { params: z.object({ workId: z.string().uuid() }) },
  responses: {
    200: {
      description: "The reader document is ready",
      content: { "application/json": { schema: readerResponseSchema } },
    },
    202: {
      description: "The reader document is still being built — retry shortly",
      content: { "application/json": { schema: readerResponseSchema } },
    },
    404: {
      description: "The work has no version this pipeline can build a reader document for",
      content: { "application/json": { schema: z.any() } },
    },
  },
});

/**
 * docs/CONTEXT.md section 10 — "Built lazily on first open via a worker job; API returns 202 with
 * status until ready." Only arXiv-sourced versions are ever buildable here (see
 * apps/worker/src/jobs/reader-build.ts) — a work whose latest version has no arXiv HTML (a
 * non-arXiv source, or arXiv PDF-only) will 202 forever rather than 404, since apps/worker's own
 * "skipped" outcome isn't surfaced back to this route. Flagged as a known gap for this milestone,
 * same scoping pattern as ADR-0007/ADR-0008's other deferrals — not silently swallowed.
 */
export function buildReaderRoutes(objectStore: ObjectStore, boss?: PgBoss) {
  const reader = new OpenAPIHono<AppEnv>({ defaultHook: validationHook });

  reader.openapi(readerRoute, async (c) => {
    const { workId } = c.req.valid("param");
    const db = c.get("db");
    const logger = c.get("logger");

    const [version] = await db
      .select({ id: workVersions.id })
      .from(workVersions)
      .where(eq(workVersions.workId, workId))
      .orderBy(desc(workVersions.publishedAt))
      .limit(1);
    if (!version) {
      throw new AppError(404, "work_version_not_found", "This work has no version on file.");
    }

    const [doc] = await db
      .select()
      .from(readerDocuments)
      .where(eq(readerDocuments.workVersionId, version.id))
      .limit(1);

    if (doc) {
      const bodyHtml = await objectStore.get(doc.storageKey);
      if (!bodyHtml) {
        throw new AppError(
          500,
          "reader_document_missing_body",
          "The reader document row exists but its stored body could not be read.",
        );
      }
      return c.json(
        {
          status: "ready" as const,
          bodyHtml,
          outline: doc.outline as unknown[],
          figures: doc.figures as unknown[],
          references: doc.references as unknown[],
        },
        200,
      );
    }

    if (boss) {
      // singletonKey: opening the same never-yet-built paper twice in quick succession enqueues
      // only one build, not one per request.
      await boss
        .send(READER_BUILD_QUEUE, { workVersionId: version.id }, { singletonKey: version.id })
        .catch((err: unknown) => {
          logger?.error(
            { err, workVersionId: version.id },
            "reader route: failed to enqueue reader.build",
          );
        });
    }

    return c.json({ status: "pending" as const }, 202);
  });

  return reader;
}
