import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createdUpdatedAt, id } from "./_helpers";
import {
  interactionEventTypeEnum,
  moderationActionEnum,
  reportStatusEnum,
  surfaceEnum,
} from "./enums";
import { users } from "./users";
import { works } from "./works";

// docs/CONTEXT.md section 6.6 — "our own record of behavior ... source of truth. Partitioned by
// month, with a retention policy."
//
// Natively partitioned by RANGE(created_at) — see the raw-SQL migration that creates this table
// (packages/db/migrations/0002_partition_interaction_events.sql; Drizzle's schema DSL has no
// declarative-partitioning support, so `PARTITION BY` isn't expressible here and this table
// definition exists only so the columns/FKs/indexes stay type-checked and in sync with what that
// migration actually creates).
//
// Postgres requires every unique constraint on a partitioned table to include the partition key,
// so the primary key is (id, created_at) here, not id alone.
//
// KNOWN GAP (M1): the worker doesn't exist yet (M4), so nothing is creating next month's
// partition or dropping old ones yet — the migration below only creates the current month plus
// three ahead. Tracked there, not silently dropped.
export const interactionEvents = pgTable(
  "interaction_events",
  {
    id: uuid().notNull(),
    userId: uuid().references(() => users.id),
    anonDeviceId: text(),
    eventType: interactionEventTypeEnum().notNull(),
    workId: uuid()
      .notNull()
      .references(() => works.id),
    surface: surfaceEnum().notNull(),
    context: jsonb(), // { feed_request_id, position, ranking_version, reason }
    dwellMs: integer(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.id, t.createdAt] }),
    index("interaction_events_user_id_idx").on(t.userId),
    index("interaction_events_work_id_idx").on(t.workId),
    index("interaction_events_created_at_idx").on(t.createdAt),
  ],
);

// docs/CONTEXT.md section 6.6
export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    // Open set — CONTEXT.md never enumerates notification types (see enums.ts's comment).
    type: text().notNull(),
    payload: jsonb(),
    readAt: timestamp({ withTimezone: true }),
    channelStatus: jsonb(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_user_id_idx").on(t.userId)],
);

// docs/CONTEXT.md section 6.6 — polymorphic target (note, user, profile, and P3's take/comment
// once those tables exist), so `targetType`/`targetId` are a loose pair, not an enum+FK.
export const reports = pgTable(
  "reports",
  {
    id: id(),
    reporterId: uuid()
      .notNull()
      .references(() => users.id),
    targetType: text().notNull(),
    targetId: uuid().notNull(),
    reason: text().notNull(),
    details: text(),
    status: reportStatusEnum().notNull().default("pending"),
    ...createdUpdatedAt,
  },
  (t) => [index("reports_target_idx").on(t.targetType, t.targetId)],
);

// docs/CONTEXT.md section 6.6
export const moderationActions = pgTable(
  "moderation_actions",
  {
    id: id(),
    moderatorId: uuid()
      .notNull()
      .references(() => users.id),
    targetType: text().notNull(),
    targetId: uuid().notNull(),
    action: moderationActionEnum().notNull(),
    reason: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("moderation_actions_target_idx").on(t.targetType, t.targetId)],
);

// docs/CONTEXT.md section 6.6 — "append-only for all privileged actions." Field list is our
// design (CONTEXT.md gives only the one-line description, no field list) — `actorUserId` is
// nullable for system/automated actions (e.g. the nightly scorer recompute).
export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    actorUserId: uuid().references(() => users.id),
    action: text().notNull(),
    targetType: text(),
    targetId: uuid(),
    metadata: jsonb(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_log_actor_user_id_idx").on(t.actorUserId),
    index("audit_log_target_idx").on(t.targetType, t.targetId),
  ],
);
