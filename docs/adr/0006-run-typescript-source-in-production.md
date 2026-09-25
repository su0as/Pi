# 0006: Run apps/api (and later apps/worker) via tsx in production, not a compiled dist/

## Context

Building the M2 Dockerfile surfaced a real gap in the M0 plan: `packages/db` and `packages/core`
ship as raw TypeScript source with no build step (ADR-0001 — internal packages export `.ts` files
directly via `package.json` "exports"). That's fine for `apps/web` (Next.js transpiles them) and
for tests (Vitest transforms them), but apps/api's `build` script (`tsc -p tsconfig.build.json`)
only compiles apps/api's *own* files to `dist/`. Its compiled output still imports
`@repo/db/client`, which resolves to `packages/db/src/client.ts` — an uncompiled `.ts` file.

Verified directly (not assumed) that Node 24 natively strips TypeScript types when you hand it a
`.ts` file to run — no flag needed, `--no-strip-types` exists to turn it *off*. But that stripping
does not extend to relative import resolution: this repo's `tsconfig.base.json` uses
`moduleResolution: "Bundler"`, and NodeNext-mode builds require relative imports to be
written with `.js` extensions even though only sibling `.ts` files exist (`import ... from
"./schema/index.js"` when only `schema/index.ts` exists on disk). Plain `node` resolves that `.js`
specifier literally and throws `ERR_MODULE_NOT_FOUND` — it doesn't know to substitute the `.ts`
file the way `tsc`/`tsx` do. Confirmed by directly running `packages/db/src/schema/works.ts`
(which imports a same-directory sibling this way) with plain `node`: it fails. The identical
import resolves fine under `tsx`, because tsx's loader implements that substitution.

## Decision

`apps/api`'s `start` script runs the TypeScript source directly through `tsx`
(`tsx --env-file-if-exists=.env src/index.ts`), the same way `dev` already does (just without
`--watch`). `tsx` moved from `devDependencies` to `dependencies` accordingly, since it's now a
runtime requirement, not just a dev tool. The Dockerfile (below) has no `tsc`-compile stage — it
installs dependencies and runs `pnpm start`.

`pnpm build` (`tsc -p tsconfig.build.json`) still exists and still runs in CI. It's not vestigial:
its NodeNext-mode config is a *different, stricter* check than `pnpm typecheck`'s Bundler-mode
config, and it's exactly what caught the missing `.js` extensions in the first place. It just
isn't a deployment artifact anymore.

## Alternatives considered

- **Compile `packages/db`/`packages/core` to JS too, so apps/api's compiled `dist/` is fully
  self-contained**: rejected — reverses ADR-0001's explicit "ship source, no build step for
  internal packages" decision for two packages but not others, adding an inconsistent second
  build pipeline for marginal benefit (tsx's startup overhead is milliseconds, not a real cost at
  this scale).
- **`pnpm deploy` to assemble a pruned, self-contained bundle**: still doesn't solve the
  `.js`-imports-`.ts`-files problem underneath — the pruned bundle would contain the same raw
  `.ts` files with the same resolution issue, just fewer of them. Doesn't remove the need for
  `tsx` (or a compile step) at runtime.

## Consequences

- The Dockerfile installs full (not `--prod`-pruned) dependencies, since `tsx`,
  `@repo/db`, and `@repo/core` all need to be present and resolvable at runtime, not stripped as
  "dev-only."
- This applies to `apps/worker` too once M4 builds it out — same fix, same reasoning, not
  re-litigated.
- If a future milestone wants faster cold starts or a smaller image (serverless-style
  deployment), revisit with a real compiled-`dist/`-for-everything pipeline then — not a reason to
  add one now.
