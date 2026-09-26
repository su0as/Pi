import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { parseExternalId } from "@repo/core";
import { workIdentifiers, workRedirects } from "@repo/db/schema";
import { upsertNormalizedWork } from "@repo/sources";
import { and, eq } from "drizzle-orm";
import type { Db } from "../db.js";
import type { SourceConnectors } from "../lib/connectors.js";
import { AppError } from "../lib/problem-details.js";
import { validationHook } from "../middleware/error-handler.js";
import type { AppEnv } from "../types.js";

const resolveQuerySchema = z.object({
  id: z.string().min(1).openapi({
    description: "An arXiv ID/URL, DOI, or PMID/PubMed URL.",
    example: "1706.03762",
  }),
});

const resolveResponseSchema = z.object({
  status: z.enum(["found", "ingested", "pending"]),
  workId: z.string().uuid().optional(),
});

const resolveRoute = createRoute({
  method: "get",
  path: "/resolve",
  summary: "Resolve any arXiv ID/URL or DOI to a work, ingesting it on first sight",
  request: { query: resolveQuerySchema },
  responses: {
    200: {
      description: "Resolved to an existing or newly ingested work",
      content: { "application/json": { schema: resolveResponseSchema } },
    },
    202: {
      description: "Ingestion is still in progress — retry shortly",
      content: { "application/json": { schema: resolveResponseSchema } },
    },
    400: {
      description: "id isn't a recognizable arXiv ID/URL, DOI, or PMID",
      content: { "application/json": { schema: z.any() } },
    },
    404: {
      description: "No connector could find a record for this identifier",
      content: { "application/json": { schema: z.any() } },
    },
  },
});

/**
 * docs/CONTEXT.md section 9.3 — "GET /v1/works/resolve?id=... resolves any arXiv ID/URL or DOI to
 * an existing work, or fetches+ingests synchronously with a timeout." PMIDs are detected (so a
 * pasted PubMed link gives a clear 404 rather than a confusing 400) but lazy-ingestion for them
 * isn't in scope here — no connector in packages/sources fetches by PMID yet.
 *
 * "redirect-on-merge": follows `work_redirects` for an identifier that resolved to a work which
 * has since been merged into another. Nothing in M4 creates merges yet (that's a future
 * dedup/moderation feature) — this only follows redirects that already exist.
 */
async function resolveCanonicalWorkId(db: Db, workId: string): Promise<string> {
  const [redirect] = await db
    .select({ canonicalWorkId: workRedirects.canonicalWorkId })
    .from(workRedirects)
    .where(eq(workRedirects.oldWorkId, workId))
    .limit(1);
  return redirect?.canonicalWorkId ?? workId;
}

export function buildWorksRoutes(connectors: SourceConnectors, timeoutMs: number) {
  const worksRouter = new OpenAPIHono<AppEnv>({ defaultHook: validationHook });

  worksRouter.openapi(resolveRoute, async (c) => {
    const { id } = c.req.valid("query");
    const db = c.get("db");
    const logger = c.get("logger");

    const parsed = parseExternalId(id);
    if (!parsed) {
      throw new AppError(
        400,
        "unrecognized_identifier",
        "id is not a recognizable arXiv ID/URL, DOI, or PMID.",
      );
    }

    const [existing] = await db
      .select({ workId: workIdentifiers.workId })
      .from(workIdentifiers)
      .where(
        and(
          eq(workIdentifiers.scheme, parsed.scheme),
          eq(workIdentifiers.valueNormalized, parsed.valueNormalized),
        ),
      )
      .limit(1);

    if (existing) {
      const workId = await resolveCanonicalWorkId(db, existing.workId);
      return c.json({ status: "found" as const, workId }, 200);
    }

    if (parsed.scheme !== "arxiv" && parsed.scheme !== "doi") {
      throw new AppError(
        404,
        "work_not_found",
        `Lazy ingestion isn't available for identifier scheme "${parsed.scheme}" yet.`,
      );
    }

    const ingest = async (): Promise<{ workId: string } | null> => {
      const connector = parsed.scheme === "arxiv" ? connectors.arxiv : connectors.openalex;
      let normalized = await connector.fetchById({
        scheme: parsed.scheme,
        value: parsed.valueNormalized,
      });
      if (!normalized && parsed.scheme === "doi") {
        normalized = await connectors.crossref.fetchById({
          scheme: "doi",
          value: parsed.valueNormalized,
        });
      }
      if (!normalized) return null;
      const result = await upsertNormalizedWork(db, normalized);
      return { workId: result.workId };
    };

    const ingestPromise = ingest();
    const timedOut = Symbol("timeout");
    const raceResult = await Promise.race([
      ingestPromise,
      new Promise<typeof timedOut>((resolve) => setTimeout(() => resolve(timedOut), timeoutMs)),
    ]);

    if (raceResult === timedOut) {
      // Let ingestion keep running in the background — a later /resolve call for the same id
      // will find it via work_identifiers once it completes.
      ingestPromise.catch((err: unknown) => {
        logger?.error({ err, id }, "works.resolve: background ingestion failed");
      });
      return c.json({ status: "pending" as const }, 202);
    }

    if (!raceResult) {
      throw new AppError(404, "work_not_found", "No connector has a record of this identifier.");
    }

    return c.json({ status: "ingested" as const, workId: raceResult.workId }, 200);
  });

  return worksRouter;
}
