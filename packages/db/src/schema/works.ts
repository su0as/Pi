import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createdUpdatedAt, id } from "./_helpers";
import {
  identifierSchemeEnum,
  readerDocumentFormatEnum,
  sourceIdEnum,
  workTypeEnum,
} from "./enums";
import { topics } from "./scholarly";

/** Read-only placeholder for the `tsvector` column — Postgres computes it via a
 * `GENERATED ALWAYS AS (...) STORED` expression added in a hand-written custom migration
 * (see packages/db/migrations/0001_search_vector.sql), not through Drizzle's schema DSL, which
 * has no first-class weighted-tsvector generated-column support. Never written from app code. */
const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

// docs/CONTEXT.md section 6.1 — one canonical scholarly work, independent of where it's hosted.
export const works = pgTable(
  "works",
  {
    id: id(),
    title: text().notNull(),
    abstract: text(),
    language: text(),
    workType: workTypeEnum().notNull(),
    publishedAt: timestamp({ withTimezone: true }),
    firstSeenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    primaryTopicId: uuid().references(() => topics.id),
    openAccessStatus: text(),
    citationCount: integer().notNull().default(0),
    canonicalUrl: text(),
    mergedIntoId: uuid().references((): AnyPgColumn => works.id),
    // Maintained by a Postgres trigger on `authorships` (packages/db/migrations' custom search
    // migration), not by application code — a GENERATED column can't subquery another table, so
    // weighting search_vector by author names (CONTEXT.md section 11.1) needs this denormalized
    // cache in between.
    authorNamesCached: text(),
    searchVector: tsvector("search_vector"),
    ...createdUpdatedAt,
    // embedding (vector, nullable) is intentionally NOT created yet — CONTEXT.md marks it [P4]
    // and gives no dimension count; adding a nullable column later is a cheap migration, unlike
    // the tables M1 was told to create early. Pick the dimension when the P4 embedding provider
    // is chosen, not before.
  },
  (t) => [index("works_primary_topic_id_idx").on(t.primaryTopicId)],
);

// docs/CONTEXT.md section 6.1 — "what makes 'any link opens the same page' work."
export const workIdentifiers = pgTable(
  "work_identifiers",
  {
    id: id(),
    workId: uuid()
      .notNull()
      .references(() => works.id),
    scheme: identifierSchemeEnum().notNull(),
    valueNormalized: text().notNull(),
    // Not in CONTEXT.md's field list, added for debugging/display — the normalized value is
    // what's unique-indexed and used for lookups.
    valueRaw: text(),
    ...createdUpdatedAt,
  },
  (t) => [
    uniqueIndex("work_identifiers_scheme_value_idx").on(t.scheme, t.valueNormalized),
    index("work_identifiers_work_id_idx").on(t.workId),
  ],
);

// docs/CONTEXT.md section 6.1 — versions of a work (arXiv v1, v2; preprint vs published).
export const workVersions = pgTable(
  "work_versions",
  {
    id: id(),
    workId: uuid()
      .notNull()
      .references(() => works.id),
    source: sourceIdEnum().notNull(),
    versionLabel: text().notNull(),
    publishedAt: timestamp({ withTimezone: true }),
    license: text(),
    licenseUrl: text(),
    // Derived at ingestion time from the license allowlist (CONTEXT.md section 9.4), never set
    // by hand.
    canDisplayFullText: boolean().notNull().default(false),
    pdfUrl: text(),
    htmlUrl: text(),
    sourceUrl: text(),
    ...createdUpdatedAt,
  },
  (t) => [index("work_versions_work_id_idx").on(t.workId)],
);

// docs/CONTEXT.md section 6.1 names this entity but doesn't list its fields (unlike every
// sibling entity in that section) — this shape is our interpretation: `works.mergedIntoId` is
// the direct-parent pointer set at merge time, while this table holds the *flattened* final
// target so a multi-hop merge chain (A -> B -> C) resolves in one lookup instead of walking
// `mergedIntoId` repeatedly.
export const workRedirects = pgTable(
  "work_redirects",
  {
    id: id(),
    oldWorkId: uuid()
      .notNull()
      .references(() => works.id),
    canonicalWorkId: uuid()
      .notNull()
      .references(() => works.id),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("work_redirects_old_work_id_key").on(t.oldWorkId)],
);

// docs/CONTEXT.md section 6.1 — normalized readable version of a work_version.
export const readerDocuments = pgTable(
  "reader_documents",
  {
    id: id(),
    workVersionId: uuid()
      .notNull()
      .references(() => workVersions.id),
    format: readerDocumentFormatEnum().notNull(),
    storageKey: text().notNull(),
    outline: jsonb(),
    figures: jsonb(),
    references: jsonb(),
    pipelineVersion: integer().notNull(),
    license: text(),
    generatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("reader_documents_work_version_id_idx").on(t.workVersionId)],
);
