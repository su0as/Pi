# 0008: pg-boss as `apps/worker`'s job queue, plus an `ingestion_checkpoints` table

## Context

docs/CONTEXT.md section 9.3 already specifies `apps/worker` on pg-boss for M4's `arxiv.harvest`
cron and `work.enrich` job — this isn't a build-vs-buy decision to relitigate, just the first
milestone that actually installs it, so it gets the same "new major dependency" ADR treatment as
anything else. Version pinned at `^12.34.0` (verified against the npm registry directly, not
assumed) — a Postgres-backed queue, so it needs no new infrastructure beyond the Postgres this
repo already runs.

Two things surfaced while wiring it up that are worth recording:

1. **Dead-letter queue creation order.** pg-boss validates a queue's `deadLetter` option against
   an *existing* queue at `createQueue()` time — creating `arxiv.harvest` (with `deadLetter:
   "arxiv.harvest.dlq"`) before `arxiv.harvest.dlq` itself exists throws `Queue arxiv.harvest.dlq
   does not exist`. Caught by actually running the built `apps/worker` Docker image against the
   dev Postgres (not just typecheck/unit tests) — `apps/worker/src/jobs/{arxiv-harvest,
   work-enrich}.ts` create each `.dlq` queue first, the real queue second.
2. **No cursor for "where did the last harvest leave off."** CONTEXT.md's "configurable 6-month
   bulk window" only describes the *first* run's lookback; nothing in the section 6 domain model
   is the right place to persist "last successful `arxiv.harvest` run" for every run after that.

## Decision

Added `ingestion_checkpoints` (`packages/db/src/schema/ingestion.ts`, migration `0005`): a small
`(jobName unique, lastRunAt)` table, deliberately outside section 6's domain model (it's
operational cursor state, not scholarly or user data). `apps/worker` reads it to resume
incremental harvesting from the last run's start time, and falls back to
`HARVEST_BULK_WINDOW_MONTHS` only when no checkpoint row exists yet (a fresh install).

"Dead-letter record" (CONTEXT.md's phrase) is pg-boss's own dead-letter queue plus a structured
`logger.error` line when a job lands there (`registerArxivHarvestJob`/`registerWorkEnrichJob`'s
`.dlq` workers) — not a bespoke database table. Nothing in the M1-M4 schema is the right home for
infra-level job-failure bookkeeping, and pg-boss's own `pgboss.job` table already retains failed
jobs for inspection.

## Consequences

- `apps/worker`'s `start`/Dockerfile now follow ADR-0006 (raw TypeScript via `tsx`, no compile
  stage) — this was already flagged as pending in ADR-0006 itself, done now that M4 actually gives
  the worker real logic to run.
- If a future milestone wants queryable job-failure history beyond pg-boss's own retention
  window, revisit then — not a reason to add a table for it now.
- `ingestion_checkpoints` only tracks `arxiv.harvest` today; a second incremental-harvest source
  (OpenAlex/Crossref bulk harvesting, if ever added beyond their current fetch-by-DOI-on-demand
  scope) would reuse the same table with its own `jobName` row, not a new table.
