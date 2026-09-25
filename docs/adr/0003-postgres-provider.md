# 0003: Managed Postgres provider — Neon

## Context

CONTEXT.md section 19 lists "Neon vs Supabase" as an explicit open question, to be recorded in an
ADR at P0. Locked-in decision #5 (CONTEXT.md section 18) requires standard Postgres only — the
vendor is used purely as hosting, never as an SDK, so the choice is low-stakes to reverse: Drizzle
talks wire-protocol Postgres either way, no vendor client library in application code.

CONTEXT.md section 12.5 specifies a `local → preview (per PR) → staging → production` environment
flow, and section 12.2 lists a Postgres provider decision as needed early because schema/migration
tooling (`packages/db`, M1) is written against it.

## Decision

**Neon**, for one concrete reason: Neon's branch-per-database model maps directly onto "preview
per PR" — a GitHub Action can create a Neon branch (a full copy-on-write Postgres branch, not just
a schema) per pull request and tear it down on merge, giving each PR a real isolated database
without a second forever-running Postgres instance. Supabase doesn't have an equivalent
lightweight per-branch database story at this cost tier.

Both support `pgvector` and `pg_trgm` out of the box, so section 6 (works.embedding) and section
11 (trigram title search) are unaffected either way.

Local development stays on the `pgvector/pgvector:pg16` Docker image (`docker-compose.yml`) —
Neon/Supabase only matter for `preview`/`staging`/`production`, and switching providers later is a
connection-string change plus a Drizzle driver swap (`postgres` package points at either with no
code changes beyond the connection URL), not a schema or query rewrite.

## Alternatives considered

- **Supabase**: strong option, ships more "batteries" (built-in auth, storage, realtime) — all
  explicitly *not* used here per locked-in decision #4 (self-hosted better-auth) and #14
  (`ObjectStore` interface over R2/MinIO), so those extras aren't a differentiator for this repo.
  Revisit if a future need (e.g. Supabase Realtime for live note-rating updates) makes the
  trade-off different.
- **Self-hosted Postgres on the same box as the API**: rejected — couples DB lifecycle to
  container lifecycle, no branching for previews, manual backup story.

## Consequences

- `packages/config/env/api.ts` and `packages/config/env/worker.ts` validate `DATABASE_URL` as a
  URL; no Neon-specific env vars or SDK calls anywhere in application code — only the connection
  string changes between environments.
- CI's Postgres service container (GitHub Actions `services:`) uses the same
  `pgvector/pgvector:pg16` image as local dev, not Neon — Neon branching is for
  preview/staging/production per section 12.5, not for CI unit/integration runs.
- Revisit if the pgvector/pg_trgm extension allow-list on either provider changes, or if Neon's
  free-tier branch limits become a real constraint once preview-per-PR is wired up (M0's CI does
  not yet create Neon branches — that's a deploy-readiness (M10) concern, not blocking M0-M9).
