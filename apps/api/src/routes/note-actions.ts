import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { createAuthorReplyInputSchema, createNoteRatingInputSchema, generateId } from "@repo/core";
import { authorReplies, noteRatings, notes, notifications } from "@repo/db/schema";
import { eq } from "drizzle-orm";
import { hasApprovedClaimOnWorkAuthor, hasVerifiedIdentity } from "../lib/note-eligibility.js";
import { recomputeNoteStatus } from "../lib/note-scoring.js";
import { AppError } from "../lib/problem-details.js";
import { validationHook } from "../middleware/error-handler.js";
import { requireAuth } from "../middleware/require-auth.js";
import type { AppEnv } from "../types.js";

const rateRoute = createRoute({
  method: "post",
  path: "/{noteId}/ratings",
  request: {
    params: z.object({ noteId: z.string().uuid() }),
    body: { content: { "application/json": { schema: createNoteRatingInputSchema } } },
  },
  responses: {
    200: {
      description: "Rating recorded (created or updated)",
      content: { "application/json": { schema: z.object({ status: z.string() }) } },
    },
    403: {
      description: "Not eligible to rate",
      content: { "application/json": { schema: z.any() } },
    },
    404: { description: "No such note", content: { "application/json": { schema: z.any() } } },
  },
});

const replyRoute = createRoute({
  method: "post",
  path: "/{noteId}/replies",
  request: {
    params: z.object({ noteId: z.string().uuid() }),
    body: { content: { "application/json": { schema: createAuthorReplyInputSchema } } },
  },
  responses: {
    200: {
      description: "Reply created or updated",
      content: { "application/json": { schema: z.object({ body: z.string() }) } },
    },
    403: {
      description: "No approved author claim on this work",
      content: { "application/json": { schema: z.any() } },
    },
    404: { description: "No such note", content: { "application/json": { schema: z.any() } } },
  },
});

/**
 * docs/CONTEXT.md section 7.4/7.7 — mounted at `/v1/notes` in app.ts. Both routes require sign-in;
 * the eligibility checks (verified identity, self-rating, co-authorship, approved author claim)
 * are the same ones packages/core's `canRateNote`/`canReplyAsAuthor` describe, resolved here since
 * they need DB access those pure functions deliberately don't have.
 */
export function buildNoteActionsRoutes() {
  const router = new OpenAPIHono<AppEnv>({ defaultHook: validationHook });
  router.use("*", requireAuth);

  router.openapi(rateRoute, async (c) => {
    const { noteId } = c.req.valid("param");
    const userId = c.get("userId") as string;
    const db = c.get("db");
    const { value, reasons } = c.req.valid("json");

    const [note] = await db.select().from(notes).where(eq(notes.id, noteId)).limit(1);
    if (!note) throw new AppError(404, "note_not_found", "No note with this id.");

    if (!(await hasVerifiedIdentity(db, userId))) {
      throw new AppError(
        403,
        "not_eligible",
        "A verified affiliation or linked ORCID is required to rate.",
      );
    }
    if (userId === note.authorUserId) {
      throw new AppError(403, "self_rating_forbidden", "You can't rate your own note.");
    }
    // docs/CONTEXT.md section 7.4: a co-author's rating is still *stored* (weight 0 in scoring,
    // resolved fresh inside recomputeNoteStatus below), not rejected at submission time — only
    // self-rating is a hard submission-time block.

    await db
      .insert(noteRatings)
      .values({ id: generateId(), noteId, raterUserId: userId, value, reasons: reasons ?? [] })
      .onConflictDoUpdate({
        target: [noteRatings.noteId, noteRatings.raterUserId],
        set: { value, reasons: reasons ?? [] },
      });

    await recomputeNoteStatus(db, noteId);

    const [updated] = await db
      .select({ status: notes.status })
      .from(notes)
      .where(eq(notes.id, noteId))
      .limit(1);
    return c.json({ status: updated?.status ?? note.status }, 200);
  });

  router.openapi(replyRoute, async (c) => {
    const { noteId } = c.req.valid("param");
    const userId = c.get("userId") as string;
    const db = c.get("db");
    const { body: replyBody, addressedInVersion } = c.req.valid("json");

    const [note] = await db.select().from(notes).where(eq(notes.id, noteId)).limit(1);
    if (!note) throw new AppError(404, "note_not_found", "No note with this id.");

    if (!(await hasApprovedClaimOnWorkAuthor(db, userId, note.workId))) {
      throw new AppError(
        403,
        "no_author_claim",
        "An approved author claim on this work is required to reply as its author.",
      );
    }

    await db
      .insert(authorReplies)
      .values({
        id: generateId(),
        noteId,
        userId,
        body: replyBody,
        addressedInVersion: addressedInVersion ?? null,
      })
      .onConflictDoUpdate({
        target: [authorReplies.noteId, authorReplies.userId],
        set: { body: replyBody, addressedInVersion: addressedInVersion ?? null },
      });

    // docs/CONTEXT.md's notification list names "reply received" as a trigger for the note's own
    // author (not the replying author) — skip self-notifying when someone replies to their own note.
    if (note.authorUserId !== userId) {
      await db.insert(notifications).values({
        id: generateId(),
        userId: note.authorUserId,
        type: "reply_received",
        payload: { noteId },
      });
    }

    return c.json({ body: replyBody }, 200);
  });

  return router;
}
