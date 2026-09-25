import { authorReplies, noteEvidence, noteRatings, notes } from "@repo/db/schema";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { noteEvidenceKindSchema } from "./enums.js";

export const noteSchema = createSelectSchema(notes);
// `kind` overridden to the curated app-level enum — the DB column is plain `text` (see
// packages/db/src/schema/notes.ts), so drizzle-zod would otherwise infer `z.string()` here.
export const noteEvidenceSchema = createSelectSchema(noteEvidence, {
  kind: noteEvidenceKindSchema,
});
export const noteRatingSchema = createSelectSchema(noteRatings);
export const authorReplySchema = createSelectSchema(authorReplies);

const noteEvidenceInputSchema = createInsertSchema(noteEvidence, {
  kind: noteEvidenceKindSchema,
}).omit({
  id: true,
  noteId: true,
  createdAt: true,
});

/** docs/CONTEXT.md section 7.1: every note type requires at least one evidence item except
 * `helpful_resource`. That's a cross-field rule between `notes.type` and `note_evidence`, so it
 * can't come from a single Drizzle table's generated insert schema — composed here instead. */
export const createNoteInputSchema = createInsertSchema(notes)
  .omit({
    id: true,
    authorUserId: true,
    status: true,
    statusUpdatedAt: true,
    scorerVersion: true,
    origin: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    evidence: z.array(noteEvidenceInputSchema),
  })
  .superRefine((value, ctx) => {
    if (value.type !== "helpful_resource" && value.evidence.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "At least one evidence item is required for this note type.",
        path: ["evidence"],
      });
    }
  });

export const createNoteRatingInputSchema = createInsertSchema(noteRatings).omit({
  id: true,
  noteId: true,
  raterUserId: true,
  createdAt: true,
  updatedAt: true,
});

export const createAuthorReplyInputSchema = createInsertSchema(authorReplies).omit({
  id: true,
  noteId: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});
