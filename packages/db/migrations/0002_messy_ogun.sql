-- Convert interaction_events to a natively partitioned table — docs/CONTEXT.md section 6.6:
-- "Partitioned by month, with a retention policy." Postgres has no ALTER TABLE ... PARTITION BY,
-- so converting an existing table means drop + recreate; done here while the table is empty
-- (M1, before anything writes to it — apps/worker, which will actually populate it, doesn't
-- exist until M4).
--
-- The corresponding Drizzle schema (packages/db/src/schema/signals.ts) declares the same
-- columns/FKs/indexes/composite PK so drizzle-kit's drift check stays clean; it just can't
-- express PARTITION BY itself, which is why this is hand-written SQL instead of a generated one.

DROP TABLE "interaction_events";

CREATE TABLE "interaction_events" (
	"id" uuid NOT NULL,
	"user_id" uuid,
	"anon_device_id" text,
	"event_type" "interaction_event_type" NOT NULL,
	"work_id" uuid NOT NULL,
	"surface" "surface" NOT NULL,
	"context" jsonb,
	"dwell_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interaction_events_id_created_at_pk" PRIMARY KEY("id","created_at")
) PARTITION BY RANGE ("created_at");

ALTER TABLE "interaction_events" ADD CONSTRAINT "interaction_events_user_id_users_id_fk"
	FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "interaction_events" ADD CONSTRAINT "interaction_events_work_id_works_id_fk"
	FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE no action ON UPDATE no action;

-- Created on the partitioned parent — Postgres automatically creates a matching index on every
-- current and future partition (these become "partitioned indexes").
CREATE INDEX "interaction_events_user_id_idx" ON "interaction_events" USING btree ("user_id");
CREATE INDEX "interaction_events_work_id_idx" ON "interaction_events" USING btree ("work_id");
CREATE INDEX "interaction_events_created_at_idx" ON "interaction_events" USING btree ("created_at");

-- Current month + next 3 — KNOWN GAP (M1, tracked in signals.ts's comment): nothing creates
-- partitions past this yet, or drops old ones for retention. That's apps/worker cron (M4) or
-- M10 hardening. Until that job exists, an insert landing outside this range falls through to
-- the default partition below rather than failing outright.
CREATE TABLE "interaction_events_2026_09" PARTITION OF "interaction_events"
	FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE "interaction_events_2026_10" PARTITION OF "interaction_events"
	FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE "interaction_events_2026_11" PARTITION OF "interaction_events"
	FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE "interaction_events_2026_12" PARTITION OF "interaction_events"
	FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

-- Safety net so an insert outside the pre-created range doesn't just fail — not a substitute for
-- the M4 job actually creating the next month's partition ahead of time.
CREATE TABLE "interaction_events_default" PARTITION OF "interaction_events" DEFAULT;
