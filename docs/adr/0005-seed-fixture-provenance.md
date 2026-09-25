# 0005: Seed fixture provenance — real papers, fetched once, recorded

## Context

CLAUDE.md/M1 requires the seed script to load "~20 real arXiv works loaded through recorded
fixtures (no live network in seed or tests)." That rule is about what runs when `pnpm db:seed`
executes — it must not depend on arXiv (or anything else) being reachable, and must produce the
same result every time. It is not a rule against ever having made a live request while *building*
the fixture in the first place.

Two ways to satisfy "real, not guessed" data without live network at seed-time:

1. Write plausible-looking metadata from memory. Rejected outright — CLAUDE.md/root project rules
   say never guess a figure, and paper titles/authors/abstracts are exactly the kind of thing an
   LLM will confidently get subtly wrong (a dropped co-author, a paraphrased abstract that drifts
   from the real one).
2. Fetch the real data once from arXiv's own API, copy the response into a static fixture file,
   and never touch the network again at seed-time. This is the same idea as an HTTP
   record/replay cassette (which M4's connector tests also use, per PROMPT_01_WEB.md) applied one
   milestone early, by hand, because packages/sources doesn't exist yet.

## Decision

Chose option 2. `packages/db/src/seed/fixtures/works.ts` was built by querying
`export.arxiv.org/api/query` directly (id-list lookups for well-known papers, category-filtered
searches for `cs.RO`, `cs.HC`, `eess.SY`, `eess.SP`, `eess.IV`, `q-bio.NC` to cover categories not
otherwise represented) on 2026-09-25, and copying title/authors/abstract/published-date/categories
from the real Atom responses into the fixture. `institutions.ts` similarly comes from the live ROR
API (`api.ror.org/v2/organizations`), not memory — see that file's own header comment.

One field was deliberately left out rather than guessed: **license**. The API calls used to build
this fixture didn't request license metadata, so every seed work has `license: null` and
`canDisplayFullText: false`. Real ingestion (M4) fetches and records the actual per-version
license; seed data staying conservative here is correct, not a bug.

## Alternatives considered

- **Ship a tiny `packages/sources` arXiv connector early, just for seeding**: rejected — M4 is
  where that connector's real interface, politeness handling, and test fixtures belong. Building a
  throwaway version now would either be redone at M4 or quietly become the real one without the
  idempotent-upsert and version-handling design M4 calls for.
- **Fewer, hand-picked "obviously correct" papers only** (skip the category-search step): rejected
  — CONTEXT.md's seed category list includes `cs.RO`, `cs.HC`, `eess.SY`, `eess.SP`, `eess.IV`, and
  `q-bio.*` specifically, and this repo's author didn't have high-confidence, verified arXiv IDs
  for those categories from memory. Searching real recent papers in each was more accurate than
  guessing older "famous" papers that might not exist.

## Consequences

- If `pnpm db:seed` is ever changed to fetch live instead of reading this fixture, that's a
  deliberate M4+ decision (once `packages/sources`' connector and its own recorded-fixture test
  strategy exist), not something to slip in here.
- A few of the seeded works' secondary arXiv categories (e.g. `cs.SE`, `cs.NE`, `cs.GR`) aren't in
  `topics.ts`'s seeded taxonomy, because CONTEXT.md section 9.2's seed category list doesn't
  include them. The seed script links `work_topics` only for categories that were actually seeded
  and silently skips the rest — this is intentional scope-matching, not a missed topic.
