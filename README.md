# PI (working name)

Research paper reader + social reading + evidence-backed community notes. Read
[`docs/CONTEXT.md`](docs/CONTEXT.md) for the full product and engineering context before making
changes, and [`CLAUDE.md`](CLAUDE.md) for the working rules this repo is built under.

> "PI" is a temporary working name — see `packages/config/brand.ts`.

## Setup

Requires Node 24 LTS (see `.nvmrc`) — Vitest 5's minimum supported Node range forces this floor
even though Next.js itself would run on Node 20.

```bash
pnpm i
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
```

`apps/web` runs at http://localhost:3000, `apps/api` at http://localhost:3001. Mailpit's web UI is
at http://localhost:8025; local S3-compatible object storage (SeaweedFS, standing in for
Cloudflare R2 — see `docs/adr/0004-local-object-storage.md`) serves its S3 API on
http://localhost:8333 and a filer UI on http://localhost:8888.

Copy each app's `.env.example` to `.env` before running (`apps/web/.env.example`,
`apps/api/.env.example`, `apps/worker/.env.example`, `packages/db/.env.example`) — the defaults
match `docker-compose.yml`.

## Repo layout

```
apps/
  web/        Next.js (App Router) — UI only, calls the API
  api/        Hono HTTP API
  worker/     pg-boss job runner (jobs land starting M4)
  mobile/     placeholder — Expo app, P2
  extension/  placeholder — WXT browser extension, P2
packages/
  config/     brand.ts + zod-validated env loaders, shared to every app
  db/         Drizzle schema, migrations, seed script (packages/db/src/seed)
  core/       generateId, arXiv/DOI/PMID identifier parsing, zod schemas, permission skeletons
  (api-client, sources, reader, design-tokens, emails — added as later milestones land)
docs/
  CONTEXT.md  product + engineering source of truth
  adr/        Architecture Decision Records
```

## Commands

- `pnpm i` — install
- `docker compose up -d` — local Postgres (pgvector, pg_trgm, unaccent), Mailpit, MinIO
- `pnpm dev` — run web + api + worker
- `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`
- `pnpm db:migrate` — apply migrations; `pnpm db:generate` — generate a migration from schema
  changes; `pnpm db:seed` — load institutions/topics/demo users/arXiv fixtures
- `pnpm api:openapi` / `pnpm api-client:generate` — wired once `apps/api` + `packages/api-client`
  land (M2)

## Status

P0 foundation + data layer done (M0-M1). See `docs/CONTEXT.md` section 16 for the phase roadmap.
