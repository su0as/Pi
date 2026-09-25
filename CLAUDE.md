# CLAUDE.md

Project: research paper reader + social reading + evidence-backed community notes.
Working name "PI" is TEMPORARY. Never hardcode it; use `packages/config/brand.ts`.

**Before any significant work, read `docs/CONTEXT.md`** (product vision, domain model,
architecture, phases). Check which phase the task belongs to. Design for later phases, build
only the current one.

## Commands
<!-- Keep this section current as the repo evolves. -->
- `pnpm i`: install
- `docker compose up -d`: local Postgres (pgvector), Mailpit, MinIO
- `pnpm dev`: run web + api + worker
- `pnpm db:migrate` / `pnpm db:generate` / `pnpm db:seed`
- `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`
- `pnpm api:openapi` then `pnpm api-client:generate`

## Hard rules
1. All clients (web, mobile, extension) go through the HTTP API via `packages/api-client`.
   No client imports `packages/db` or talks to Postgres.
2. Domain logic (permissions, scoring, anchoring, ranking, validation) lives in `packages/core`
   as pure, tested functions. Route handlers stay thin.
3. Schema changes only through Drizzle migrations. Never edit an applied migration.
4. Validate every boundary with zod (HTTP input, env vars, external API responses, job payloads).
5. TypeScript strict. No `any`, no `@ts-ignore` without a linked reason.
6. No user-facing strings inline. Use the i18n layer (web: next-intl, mobile: i18next).
7. Never store or serve paywalled PDFs. Respect source rate limits (arXiv: 1 req / 3 s).
   Full text display only when `can_display_full_text` is true.
8. Sanitize all HTML server-side before rendering.
9. IDs are UUIDv7 generated in app code. Soft delete user content (`deleted_at`).
10. New infrastructure, paid service, or major dependency means write an ADR in `docs/adr/` first.
11. Never commit secrets. Add every new env var to the zod env schema and `.env.example`.
12. Do not claim something works until you've run it (tests, typecheck, or a real request).
    Report what you verified and what you didn't.

## Conventions
- Conventional Commits (`feat(api): ...`). Small, focused commits.
- Files: kebab-case. React components: PascalCase. DB: snake_case plural tables.
- API: `/v1`, cursor pagination `{ data, nextCursor }`, errors as RFC 9457 problem+json,
  `Idempotency-Key` on creating POSTs.
- Tests next to code (`*.test.ts`). `packages/core` needs high coverage; API integration tests
  hit a real Postgres (docker), and external HTTP is replayed from recorded fixtures.
- Prefer official docs over memory for library APIs and versions; use latest stable releases.

## When unsure
Ask one concise question with a recommended default rather than guessing on product
behavior. For purely technical choices within these rules, decide, and note it in the PR/summary.
