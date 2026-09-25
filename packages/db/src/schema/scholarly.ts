import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { pgTable, text, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdUpdatedAt, id } from "./_helpers.js";
import { topicSchemeEnum } from "./enums.js";

// docs/CONTEXT.md section 6.1 — people as authors, not app users (see schema/users.ts for those).
export const persons = pgTable(
  "persons",
  {
    id: id(),
    displayName: text().notNull(),
    orcid: text(),
    openalexId: text(),
    ...createdUpdatedAt,
  },
  (t) => [
    uniqueIndex("persons_orcid_idx").on(t.orcid),
    uniqueIndex("persons_openalex_id_idx").on(t.openalexId),
  ],
);

// docs/CONTEXT.md section 6.1 — "keyed by ROR ID".
export const institutions = pgTable(
  "institutions",
  {
    id: id(),
    rorId: text().notNull(),
    name: text().notNull(),
    country: text(),
    emailDomains: text().array().notNull().default([]),
    ...createdUpdatedAt,
  },
  (t) => [uniqueIndex("institutions_ror_id_idx").on(t.rorId)],
);

// docs/CONTEXT.md section 6.1 — unified taxonomy with source scheme.
export const topics = pgTable(
  "topics",
  {
    id: id(),
    scheme: topicSchemeEnum().notNull(),
    code: text().notNull(),
    name: text().notNull(),
    parentId: uuid().references((): AnyPgColumn => topics.id),
    ...createdUpdatedAt,
  },
  (t) => [unique("topics_scheme_code_key").on(t.scheme, t.code)],
);
