# 0002: Lint and format — Biome

## Context

CONTEXT.md section 12.3 already named Biome as the "no-regret" choice for lint/format
("one fast tool" replacing the historical ESLint+Prettier combo). Need to confirm that still
holds and configure it.

## Decision

Use `@biomejs/biome` 2.5.x for both linting and formatting, configured at the repo root
(`biome.json`), run via `pnpm lint` / `pnpm lint:fix` and as a CI gate. Biome 2.x's rule set
(~490 rules, including type-aware rules) covers the vast majority of what a
`eslint` + `typescript-eslint` + `prettier` stack would have provided, in a single fast,
Rust-based tool with one config file.

## Alternatives considered

- **ESLint + Prettier**: more plugins exist for niche rules, but two tools/configs to keep in
  sync, and meaningfully slower on a growing monorepo. Rejected — no rule set gap found that
  matters for this codebase.
- **oxlint**: fast but format story is less mature than Biome's; rejected for now.

## Consequences

- If a specific ESLint plugin rule turns out to matter later (e.g. a Next.js-specific or
  Tailwind-specific lint rule with no Biome equivalent), that's a case-by-case addition of a
  narrow ESLint pass for just that rule — not a wholesale revert of this decision. None identified
  as necessary at M0.
- `biome.json`'s `files.includes` excludes build output directories; VCS integration
  (`vcs.useIgnoreFile`) means it also respects `.gitignore`.
