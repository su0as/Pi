import { type CountedRating, scorerV0 } from "@repo/core";
import { generateId } from "@repo/db/id";
import { noteRatings, noteStatusHistory, notes, notifications } from "@repo/db/schema";
import { eq } from "drizzle-orm";
import type { Db } from "../db.js";
import { isCoAuthorOfWork, loadScoringConfig, resolveDiversityKey } from "./note-eligibility.js";

/**
 * docs/CONTEXT.md section 7.5 — "Recompute synchronously on each rating." Re-resolves every
 * rating's conflict-of-interest and diversity-key status fresh each time (not just at submission
 * time) — see packages/core's `CountedRating` doc comment for why that matters (a claim approved
 * after a rating was submitted must still exclude it going forward).
 */
export async function recomputeNoteStatus(db: Db, noteId: string): Promise<void> {
  const [note] = await db.select().from(notes).where(eq(notes.id, noteId)).limit(1);
  if (!note) throw new Error(`recomputeNoteStatus: no note ${noteId}`);

  const allRatings = await db.select().from(noteRatings).where(eq(noteRatings.noteId, noteId));

  const counted: CountedRating[] = [];
  for (const rating of allRatings) {
    if (rating.raterUserId === note.authorUserId) continue; // can't rate your own note
    if (await isCoAuthorOfWork(db, rating.raterUserId, note.workId)) continue; // stored, weight 0
    const diversityKey = await resolveDiversityKey(db, rating.raterUserId);
    counted.push({ value: rating.value, diversityKey });
  }

  const config = await loadScoringConfig(db);
  const result = scorerV0.score(counted, config);

  const statusChanged = result.status !== note.status;

  await db
    .update(notes)
    .set({ status: result.status, scorerVersion: config.version, statusUpdatedAt: new Date() })
    .where(eq(notes.id, noteId));

  await db.insert(noteStatusHistory).values({
    id: generateId(),
    noteId,
    status: result.status,
    scorerVersion: config.version,
    inputs: result.inputs,
  });

  // docs/CONTEXT.md section 8/7.7-adjacent — notify the note's author when its status actually
  // changes (not on every rating, only real transitions), e.g. "your note is now Helpful."
  if (
    statusChanged &&
    (result.status === "currently_rated_helpful" || result.status === "currently_rated_not_helpful")
  ) {
    await db.insert(notifications).values({
      id: generateId(),
      userId: note.authorUserId,
      type: "note_status_changed",
      payload: { noteId, status: result.status },
    });
  }
}
