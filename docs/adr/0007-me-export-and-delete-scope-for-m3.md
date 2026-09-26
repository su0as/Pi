# 0007: `/v1/me/export` and `DELETE /v1/me` — synchronous and email-inline for M3

## Context

M3's brief (from the session that produced `PROMPT_01_WEB.md`) calls for `POST /v1/me/export`
as "an async job, email link" and `DELETE /v1/me` as "soft-delete + scheduled purge job." Both
assume infrastructure that doesn't exist yet at M3:

- "Async job" implies a job queue. `apps/worker`'s pg-boss wiring is M4's scope, not M3's — there
  is no job runner to hand either of these off to.
- "Email link" implies uploading the export somewhere and linking to it. The `ObjectStore`
  interface (docs/CONTEXT.md section 10, `packages/reader`) doesn't exist until M5.
- "Scheduled purge job" (hard-deleting old soft-deleted rows after a retention window) is,
  again, a job — M4/M10, not M3.

## Decision

For M3: `POST /v1/me/export` runs synchronously inside the request — gathers the user's rows
from every table that currently has a `userId`/`authorUserId` column (affiliations,
library_items, collections, highlights, notes, note_ratings, author_replies — most still empty,
since their own write paths land in later milestones, which is fine: the export is complete for
what exists today), serializes to JSON, and emails it **inline in the message body** rather than
as an uploaded-then-linked file.

`DELETE /v1/me` does the *soft-delete and anonymization* part immediately and synchronously
(`status = 'deleted'`, `deletedAt` set, `displayName`/`handle`/`email`/`bio`/avatar overwritten,
every session revoked) — CONTEXT.md section 6.2's anonymized-attribution requirement doesn't
actually need a job queue, only the scheduled hard-purge does. That part is deferred, and flagged
as a known gap in the route's own code comment, not silently dropped.

## Alternatives considered

- **Wait and build M3's auth/identity work together with M4's worker**, so the "real" async
  versions could be built directly: rejected — blocks all of M3 (sign-in, affiliation
  verification, roles) on M4 landing first, for the sake of two specific endpoints' async-ness.
- **Fake asynchrony** (return `202 Accepted` immediately, do the same synchronous work
  in the background without a real queue): rejected — that's synchronous work with extra steps
  and a misleading status code; being upfront that it's synchronous for now is more honest and no
  slower in practice at this data scale.

## Consequences

- Revisit `/v1/me/export` once M5's `ObjectStore` exists: upload the JSON, email a link instead
  of the payload inline. Worth doing once exports are large enough that emailing the full body
  stops being reasonable — not urgent while most exports are near-empty.
- Revisit the hard-purge side of `DELETE /v1/me` once M4's pg-boss cron exists — a scheduled job
  that finds `users` rows with `status = 'deleted'` past the retention window and actually
  removes them (or decides retention is unnecessary and removes immediately — a product decision,
  not just an infra one, worth a separate ADR when that job is actually built).
- Every other M3 flow (sign-in via Google/Apple/email OTP, affiliation verification, role checks)
  has no such gap — those don't depend on M4 or M5 infrastructure.
