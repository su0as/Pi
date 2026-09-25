import {
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { createdUpdatedAt, id } from "./_helpers";
import { libraryItemStatusEnum, surfaceEnum } from "./enums";
import { users } from "./users";
import { works, workVersions } from "./works";

// docs/CONTEXT.md section 6.3 — private by default.
export const libraryItems = pgTable(
  "library_items",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    workId: uuid()
      .notNull()
      .references(() => works.id),
    status: libraryItemStatusEnum().notNull().default("to_read"),
    savedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp({ withTimezone: true }),
    progress: jsonb(), // { version, position }
    sourceSurface: surfaceEnum(),
  },
  (t) => [
    unique("library_items_user_work_key").on(t.userId, t.workId),
    index("library_items_user_id_idx").on(t.userId),
  ],
);

// docs/CONTEXT.md section 6.3 — named but not field-listed there; a user-owned named group of
// works, distinct from the to-read/reading/read status tracked on library_items directly.
export const collections = pgTable(
  "collections",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    name: text().notNull(),
    ...createdUpdatedAt,
  },
  (t) => [index("collections_user_id_idx").on(t.userId)],
);

export const collectionItems = pgTable(
  "collection_items",
  {
    collectionId: uuid()
      .notNull()
      .references(() => collections.id),
    workId: uuid()
      .notNull()
      .references(() => works.id),
    addedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.collectionId, t.workId] })],
);

// docs/CONTEXT.md section 6.3 — private annotations, anchored the same way as notes.
export const highlights = pgTable(
  "highlights",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    workVersionId: uuid()
      .notNull()
      .references(() => workVersions.id),
    anchor: jsonb().notNull(), // W3C Web Annotation selectors — see docs/CONTEXT.md section 7.2
    color: text(),
    comment: text(),
    ...createdUpdatedAt,
  },
  (t) => [index("highlights_user_id_idx").on(t.userId)],
);
