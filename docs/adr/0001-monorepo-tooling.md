# 0001: Monorepo tooling — pnpm workspaces + Turborepo

## Context

The product spans a web app, an HTTP API, a worker, and (later) an iOS app and a browser
extension, all sharing domain types, validation, scoring, and an API client
(`docs/CONTEXT.md` sections 12.2–12.3). A prior discussion (captured in the session that produced
this repo) already settled on one repo over separate repos per app, specifically because:

- Web, iOS, extension, and API all consume the same `packages/core` and `packages/api-client`;
  splitting repos would mean publishing those as private npm packages and keeping versions in
  sync by hand.
- A single schema/domain change (e.g. adding a field to notes) touches DB, API, and web in one
  pull request instead of four repos that can drift.
- It's a single-person project at this stage — multi-repo mainly pays off when separate teams own
  separate parts.
- Expo/EAS, Vercel (root-directory config), and Turborepo all support monorepos directly.

## Decision

pnpm workspaces (`pnpm-workspace.yaml`) for package linking, Turborepo (`turbo.json`) for task
orchestration and caching. Internal packages (`packages/*`) ship TypeScript source directly via
`package.json` "exports" (no separate build step) and are consumed with `transpilePackages` in
Next.js and `vitest`'s TS-native transform elsewhere — avoiding a build-then-consume step during
active development. `apps/api` and `apps/worker` do get a real `tsc` build step (`build` script)
since they ship as standalone Docker images, not consumed as workspace packages.

## Alternatives considered

- **Separate repos per app**: rejected per the reasoning above — the shared-package overhead
  dominates at this team size and this stage.
- **Nx** instead of Turborepo: both are solid; Turborepo's simpler task-graph model and first-party
  Vercel integration (this repo deploys `apps/web` to Vercel) tipped it, and CONTEXT.md already
  named Turborepo as a "no-regret" choice.
- **npm/yarn workspaces** instead of pnpm: pnpm's strict, disk-efficient linking catches phantom
  dependencies earlier and is what Expo's own monorepo guide is written against.

## Consequences

- **Node baseline is 24 LTS**, not the 20.9.0 floor Next.js itself would tolerate — Vitest 5
  requires Node `^22.12.0 || ^24.0.0 || >=26.0.0`, and 24 ("Krypton") is the current Active LTS as
  of this decision, so it's the floor for every app and for CI (`.nvmrc` is the source of truth;
  `engines.node` in the root `package.json` enforces it on install).
- CI must run `pnpm i` with a cache key on the lockfile, then `turbo run <task>` so unaffected
  packages/apps are skipped on PRs that only touch one app.
- Internal packages being unbuilt TS means every consumer (Next.js, Vitest, `tsx`) needs to be
  configured to transform them — done via `transpilePackages` (Next) and `server.deps.inline` /
  native TS support (Vitest, tsx). This is a one-time setup cost per new package, not per file.
- Renovate is configured to group related packages (e.g. `next`/`react`/`react-dom`,
  `drizzle-orm`/`drizzle-kit`) to avoid partial upgrades breaking peer dependency ranges.
