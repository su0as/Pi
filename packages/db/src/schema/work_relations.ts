import {
  index,
  integer,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { id } from "./_helpers";
import { institutions, persons, topics } from "./scholarly";
import { works } from "./works";

// docs/CONTEXT.md section 6.1
export const authorships = pgTable(
  "authorships",
  {
    id: id(),
    workId: uuid()
      .notNull()
      .references(() => works.id),
    personId: uuid()
      .notNull()
      .references(() => persons.id),
    position: integer().notNull(),
    rawName: text(),
    rawAffiliation: text(),
    institutionId: uuid().references(() => institutions.id),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("authorships_work_id_idx").on(t.workId),
    index("authorships_person_id_idx").on(t.personId),
  ],
);

// docs/CONTEXT.md section 6.1
export const workTopics = pgTable(
  "work_topics",
  {
    workId: uuid()
      .notNull()
      .references(() => works.id),
    topicId: uuid()
      .notNull()
      .references(() => topics.id),
    score: real().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.workId, t.topicId] }),
    index("work_topics_topic_id_idx").on(t.topicId),
  ],
);

// docs/CONTEXT.md section 6.1 — "resolved lazily". Table named `references` there; exported as
// `workReferences` here to avoid reading like the Drizzle `.references()` column-builder call.
export const workReferences = pgTable(
  "references",
  {
    id: id(),
    citingWorkId: uuid()
      .notNull()
      .references(() => works.id),
    citedWorkId: uuid().references(() => works.id),
    rawCitation: text(),
    position: integer(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("references_citing_work_id_idx").on(t.citingWorkId),
    index("references_cited_work_id_idx").on(t.citedWorkId),
  ],
);
