import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { createNoteInputSchema, generateId } from "@repo/core";
import {
  authorClaims,
  authorReplies,
  authorships,
  noteEvidence,
  noteRatings,
  notes,
  notifications,
  works,
} from "@repo/db/schema";
import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../db.js";
import {
  countCompletedRatings,
  hasVerifiedIdentity,
  loadScoringConfig,
} from "../lib/note-eligibility.js";
import { recomputeNoteStatus } from "../lib/note-scoring.js";
import { AppError } from "../lib/problem-details.js";
import { validationHook } from "../middleware/error-handler.js";
import { requireAuth } from "../middleware/require-auth.js";
import type { AppEnv } from "../types.js";

const noteResponseSchema = z.object({
  id: z.string().uuid(),
  workId: z.string().uuid(),
  workVersionId: z.string().uuid().nullable(),
  authorUserId: z.string().uuid(),
  type: z.string(),
  body: z.string(),
  anchor: z.unknown().nullable(),
  status: z.string(),
  createdAt: z.string(),
  ratingCounts: z.object({ helpful: z.number(), somewhat: z.number(), not_helpful: z.number() }),
  evidence: z.array(
    z.object({ kind: z.string(), url: z.string().nullable(), label: z.string().nullable() }),
  ),
  authorReply: z.object({ body: z.string(), addressedInVersion: z.string().nullable() }).nullable(),
});

const createNoteRoute = createRoute({
  method: "post",
  path: "/{workId}/notes",
  request: {
    params: z.object({ workId: z.string().uuid() }),
    body: { content: { "application/json": { schema: createNoteInputSchema } } },
  },
  responses: {
    201: {
      description: "Note created",
      content: { "application/json": { schema: noteResponseSchema } },
    },
    400: { description: "Invalid note", content: { "application/json": { schema: z.any() } } },
    403: {
      description: "Not eligible to write a note yet",
      content: { "application/json": { schema: z.any() } },
    },
  },
});

const listNotesRoute = createRoute({
  method: "get",
  path: "/{workId}/notes",
  request: { params: z.object({ workId: z.string().uuid() }) },
  responses: {
    200: {
      description: "Notes for this work, ordered helpful → needs more ratings → not helpful",
      content: { "application/json": { schema: z.object({ data: z.array(noteResponseSchema) }) } },
    },
  },
});

const STATUS_ORDER: Record<string, number> = {
  currently_rated_helpful: 0,
  needs_more_ratings: 1,
  draft: 1,
  currently_rated_not_helpful: 2,
  withdrawn: 3,
  removed: 3,
};

async function serializeNote(db: Db, noteId: string) {
  const [note] = await db.select().from(notes).where(eq(notes.id, noteId)).limit(1);
  if (!note) return null;

  const ratings = await db
    .select({ value: noteRatings.value })
    .from(noteRatings)
    .where(eq(noteRatings.noteId, noteId));
  const ratingCounts = { helpful: 0, somewhat: 0, not_helpful: 0 };
  for (const r of ratings) ratingCounts[r.value]++;

  const evidence = await db
    .select({ kind: noteEvidence.kind, url: noteEvidence.url, label: noteEvidence.label })
    .from(noteEvidence)
    .where(eq(noteEvidence.noteId, noteId));

  const [reply] = await db
    .select({ body: authorReplies.body, addressedInVersion: authorReplies.addressedInVersion })
    .from(authorReplies)
    .where(eq(authorReplies.noteId, noteId))
    .limit(1);

  return {
    id: note.id,
    workId: note.workId,
    workVersionId: note.workVersionId,
    authorUserId: note.authorUserId,
    type: note.type,
    body: note.body,
    anchor: note.anchor,
    status: note.status,
    createdAt: note.createdAt.toISOString(),
    ratingCounts,
    evidence,
    authorReply: reply ?? null,
  };
}

export function buildWorkNotesRoutes() {
  const router = new OpenAPIHono<AppEnv>({ defaultHook: validationHook });

  router.use("*", async (c, next) => {
    if (c.req.method === "POST") return requireAuth(c, next);
    return next();
  });

  router.openapi(createNoteRoute, async (c) => {
    const { workId } = c.req.valid("param");
    const userId = c.get("userId") as string;
    const db = c.get("db");
    const body = c.req.valid("json");

    if (body.workId !== workId) {
      throw new AppError(400, "work_id_mismatch", "Body workId must match the URL.");
    }

    const [work] = await db
      .select({ id: works.id })
      .from(works)
      .where(eq(works.id, workId))
      .limit(1);
    if (!work) throw new AppError(404, "work_not_found", "No work with this id.");

    const config = await loadScoringConfig(db);
    const verified = await hasVerifiedIdentity(db, userId);
    if (!verified) {
      throw new AppError(
        403,
        "not_eligible",
        "A verified affiliation or linked ORCID is required to write a note.",
      );
    }
    if (!config.bootstrapMode) {
      const completed = await countCompletedRatings(db, userId);
      if (completed < config.writeRequiredRatings) {
        throw new AppError(
          403,
          "not_eligible",
          `Rate ${config.writeRequiredRatings - completed} more note(s) before you can write one.`,
        );
      }
    }

    const noteId = generateId();
    const { evidence, ...noteFields } = body;
    await db.insert(notes).values({ id: noteId, ...noteFields, authorUserId: userId });
    if (evidence.length > 0) {
      await db
        .insert(noteEvidence)
        .values(evidence.map((e) => ({ id: generateId(), noteId, ...e })));
    }

    // Recompute immediately so a brand-new note gets a real status (needs_more_ratings at N=0)
    // instead of sitting at the table's bare "draft" default — docs/CONTEXT.md section 7.3's
    // lifecycle diagram: "draft → NEEDS_MORE_RATINGS" happens right away, not on a delay.
    await recomputeNoteStatus(db, noteId);

    // docs/CONTEXT.md section 7.7 — "Authors are notified when a note is created on their work
    // (if claimed)."
    const claimedAuthorRows = await db
      .select({ userId: authorClaims.userId })
      .from(authorClaims)
      .innerJoin(authorships, eq(authorships.personId, authorClaims.personId))
      .where(and(eq(authorships.workId, workId), eq(authorClaims.status, "approved")));
    for (const row of claimedAuthorRows) {
      await db.insert(notifications).values({
        id: generateId(),
        userId: row.userId,
        type: "note_on_authored_work",
        payload: { noteId, workId },
      });
    }

    const serialized = await serializeNote(db, noteId);
    if (!serialized) throw new Error("unreachable: note was just created");
    return c.json(serialized, 201);
  });

  router.openapi(listNotesRoute, async (c) => {
    const { workId } = c.req.valid("param");
    const db = c.get("db");

    const rows = await db
      .select({ id: notes.id, status: notes.status, createdAt: notes.createdAt })
      .from(notes)
      .where(eq(notes.workId, workId))
      .orderBy(desc(notes.createdAt));

    const visible = rows.filter((r) => r.status !== "removed" && r.status !== "withdrawn");
    visible.sort((a, b) => {
      const orderDiff = (STATUS_ORDER[a.status] ?? 1) - (STATUS_ORDER[b.status] ?? 1);
      if (orderDiff !== 0) return orderDiff;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    const data = [];
    for (const row of visible) {
      const serialized = await serializeNote(db, row.id);
      if (serialized) data.push(serialized);
    }
    return c.json({ data }, 200);
  });

  return router;
}
