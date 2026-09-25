import { index, integer, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { createdUpdatedAt, id } from "./_helpers";
import { noteOriginEnum, noteRatingValueEnum, noteStatusEnum, noteTypeEnum } from "./enums";
import { users } from "./users";
import { works, workVersions } from "./works";

// docs/CONTEXT.md section 6.5 / 7
export const notes = pgTable(
  "notes",
  {
    id: id(),
    workId: uuid()
      .notNull()
      .references(() => works.id),
    workVersionId: uuid().references(() => workVersions.id),
    authorUserId: uuid()
      .notNull()
      .references(() => users.id),
    type: noteTypeEnum().notNull(),
    body: text().notNull(),
    anchor: jsonb(), // W3C selectors, nullable — some note types aren't anchored to a passage
    status: noteStatusEnum().notNull().default("draft"),
    statusUpdatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    // Which scoring_params.version last computed `status` — null until the scorer has run once.
    scorerVersion: integer(),
    origin: noteOriginEnum().notNull().default("direct"),
    language: text(),
    ...createdUpdatedAt,
  },
  (t) => [
    index("notes_work_id_idx").on(t.workId),
    index("notes_author_user_id_idx").on(t.authorUserId),
    index("notes_status_idx").on(t.status),
  ],
);

// docs/CONTEXT.md section 6.5 — "at least one required except helpful_resource" (enforced in
// packages/core, not the DB — see packages/core/src/schemas/note.ts).
export const noteEvidence = pgTable(
  "note_evidence",
  {
    id: id(),
    noteId: uuid()
      .notNull()
      .references(() => notes.id),
    // Open set — CONTEXT.md doesn't enumerate evidence kinds, only gives examples per note type
    // (repo, logs, numbers, citation, link, upload).
    kind: text().notNull(),
    url: text(),
    workId: uuid().references(() => works.id), // set when kind === "publication"
    storageKey: text(), // set when kind is an upload
    label: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("note_evidence_note_id_idx").on(t.noteId)],
);

// docs/CONTEXT.md section 6.5 — "unique per note and rater, editable."
export const noteRatings = pgTable(
  "note_ratings",
  {
    id: id(),
    noteId: uuid()
      .notNull()
      .references(() => notes.id),
    raterUserId: uuid()
      .notNull()
      .references(() => users.id),
    value: noteRatingValueEnum().notNull(),
    reasons: text().array().notNull().default([]),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [unique("note_ratings_note_rater_key").on(t.noteId, t.raterUserId)],
);

// docs/CONTEXT.md section 6.5 / 7.3 — every scorer computation writes one of these.
export const noteStatusHistory = pgTable(
  "note_status_history",
  {
    id: id(),
    noteId: uuid()
      .notNull()
      .references(() => notes.id),
    status: noteStatusEnum().notNull(),
    scorerVersion: integer().notNull(),
    computedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    inputs: jsonb(),
  },
  (t) => [index("note_status_history_note_id_idx").on(t.noteId)],
);

// docs/CONTEXT.md section 6.5 / 7.7 — "one reply per claimed author per note, editable."
export const authorReplies = pgTable(
  "author_replies",
  {
    id: id(),
    noteId: uuid()
      .notNull()
      .references(() => notes.id),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    body: text().notNull(),
    addressedInVersion: text(),
    ...createdUpdatedAt,
  },
  (t) => [unique("author_replies_note_user_key").on(t.noteId, t.userId)],
);

// docs/CONTEXT.md section 6.5 — "versioned JSON of thresholds, so changes are auditable." Rows
// are append-only; the scorer (packages/core) reads the highest `version`, never mutates a row.
export const scoringParams = pgTable(
  "scoring_params",
  {
    id: id(),
    version: integer().notNull(),
    params: jsonb().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("scoring_params_version_key").on(t.version)],
);
