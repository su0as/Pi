import { integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// API-layer infrastructure — not part of docs/CONTEXT.md's domain model (section 6), needed by
// M2's middleware stack (docs/CONTEXT.md section 12.4: "Idempotency-Key header supported on all
// creating POSTs", rate limiting "per user and per IP").

/** One row per (Idempotency-Key, requester) — a creating POST replays the stored response
 * instead of re-executing when the same key arrives again before `expiresAt`. */
export const idempotencyKeys = pgTable("idempotency_keys", {
  key: text().primaryKey(),
  userId: uuid(),
  method: text().notNull(),
  path: text().notNull(),
  // Hash of the request body — a replayed key with a *different* body is a client bug, not a
  // legitimate retry, and the store rejects it (see apps/api's idempotency middleware).
  requestHash: text().notNull(),
  responseStatus: integer().notNull(),
  responseBody: jsonb(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
});

/** Fixed-window rate limiting. `key` is caller-defined (e.g. `ip:<addr>` or `user:<id>`); a
 * window resets by deleting/overwriting once `windowStart` is old enough — see
 * apps/api's rate-limit middleware for the actual algorithm. */
export const rateLimitBuckets = pgTable("rate_limit_buckets", {
  key: text().primaryKey(),
  windowStart: timestamp({ withTimezone: true }).notNull(),
  count: integer().notNull().default(0),
});
