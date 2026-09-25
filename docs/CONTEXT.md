# PI: Product and Engineering Context

> "PI" is a TEMPORARY working name. It must never be hardcoded anywhere in code, database
> identifiers, bundle IDs, or URLs. All brand strings come from `packages/config/brand.ts`.

This document is the source of truth for **what we are building, for whom, why, and how the
system is shaped end to end** (web, iOS, browser extension, email, public API). It is not a
build script. Individual work sessions get their own task prompts; this document gives every
session the same long-term picture so that early decisions do not have to be undone later.

If code and this document disagree, do not silently pick one. Flag it, then update this
document (and add an ADR in `docs/adr/`) in the same change.

Phase tags used throughout: **[P0]** foundation, **[P1]** web MVP, **[P2]** iOS + extension MVP,
**[P3]** social layer, **[P4]** multi-source coverage, **[P5]** trust at scale, **[P6]** platform
and revenue. Anything tagged later than the current phase must be *designed for* (schemas,
interfaces, naming) but not *built*.

---

## 1. One line

**PI is where researchers read papers and see what real readers think of them, and whether
the claims actually hold up.**

- alphaXiv explains a paper with AI. PI shows what people who read, ran, or checked the paper
  found, backed by evidence.
- Think: a great reader + Letterboxd-style social reading + X-style Community Notes, for
  research papers from every field.

## 2. Why this should exist (supply and demand)

| Thing | Supply | Demand | Implication |
|---|---|---|---|
| Papers | Exploding | Human reading time is fixed | Oversupplied |
| AI summaries / chat-with-PDF | Near-free | High but commoditized | Not a moat. Do not compete here. |
| Triage ("which 10 of 1,000 matter to me") | Scarce | Very high | Core value of feed + social signal |
| Trust ("does this result hold up") | Very scarce | High, rising as AI-written papers flood in | Core value of community notes |
| Machine-readable, verified results | Nearly nonexistent | Low today, high once AI research agents are common | Long-term data asset and API business |

**The moat is not paper coverage and not UI.** Both are copyable. The moat is data that
accrues only from use:
1. The social graph (who follows whom, who reads what, circles).
2. Takes and community notes with evidence and ratings.
3. Interaction signal (saves, skips, dwell) that powers triage.

## 3. Users

### Launch market: NTU Singapore, then NUS / SMU / other SG universities, then global.

| Persona | Why they come | What they give back | Priority |
|---|---|---|---|
| **Student reader** (MSc, undergrad, final-year project) | Reading on phone that doesn't suck; feed for their topics; see what classmates read | Saves, ratings, takes, reproduction results from coursework | **Primary at launch** |
| **PhD / postdoc** | Triage; "who's reading my paper"; circles for their lab | Takes, notes, ratings | Secondary at launch, primary later |
| **Faculty / lab head (the real-world "PI")** | See reception of their work; right of reply; lab circle | Author replies, credibility | Pulled in by activity on their papers |
| **Reading-group / journal-club organizer** | Free tool to run the group (schedule, presenter, discussion, library) | Brings 10 to 20 members at once; discussions become notes | **Key growth channel** |
| **Industry R&D team** [P6] | Team workspace, digests, verified notes on papers they build on | Revenue | Later |
| **AI agents / tools** [P6] | Query verified notes and results | API revenue | Later |

## 4. Product principles (tie-breakers for every decision)

1. **Reading first, social second, notes third.** People arrive for reading, stay for social,
   and contribute notes last. Never lead onboarding with "write a community note".
2. **People over AI.** AI may assist (explain a term, check a note draft, short TL;DR behind a
   flag). AI never produces verdicts, notes, or ratings.
3. **Evidence over opinion.** Community notes require evidence. Takes may be opinion and are
   labeled as such.
4. **Fair to authors.** Authors always get a right of reply shown next to the note.
5. **Private by default for behavior, public by choice for contributions.** Reading history and
   library are private by default. Takes and notes are public by default.
6. **Any paper, any field; community seeded narrow.** Anything with an arXiv ID or DOI must open.
   Community effort (seeding, circles) focuses on 2 to 3 fields at a time.
7. **Phone reading is first-class**, not a shrunken desktop.
8. **Cheap to run.** Value is created by people, not subsidized inference. No feature may add
   unbounded per-user LLM cost without a hard budget cap.
9. **Calm, precise tone.** No "debunked", no dunking. We show evidence and replies.

## 5. Surfaces (end vision)

```
                         ┌───────────────────────────────┐
                         │   API (/v1, OpenAPI)          │
                         │   + Worker (jobs, ingestion)  │
                         │   Postgres, object storage    │
                         └───────────────┬───────────────┘
      ┌──────────────┬───────────────┬───┴──────────┬──────────────┬──────────────┐
      v              v               v              v              v              v
   WEB APP       iOS APP        BROWSER EXT     EMAIL          PUBLIC API     ADMIN
   [P1]          [P2]           [P2]            [P3]           + MCP [P6]     [P1 minimal]
   deep work     feed, triage,  notes badges    weekly digest  agents, labs   moderation
   read, write   read, rate,    on arXiv,       notifications
   notes, rate   library        Scholar, etc.
```

Every client talks to the same HTTP API. No client talks to the database directly.

### 5.1 Web app [P1]
Where real work happens (researchers live on laptops and Google Scholar).
- Home: For you, Notes to rate, Trending with notes; [P3] Circles, Following activity.
- Paper page: metadata, notes status bar, reader (reflowed HTML or PDF), notes side panel,
  save, share, add to circle [P3], takes [P3].
- Reader with text selection, which lets you anchor a note to a passage, figure, or table.
- Search (title, authors, abstract, IDs, DOIs) with filters.
- Library: statuses (to read, reading, read), collections, private highlights.
- Rate queue.
- Profiles: affiliations, notes, ratings impact, takes [P3].
- Settings: account, affiliations, notifications, privacy, data export, account deletion.
- **arXiv URL swap:** `/abs/{arxivId}`, `/pdf/{arxivId}`, `/html/{arxivId}` resolve to the paper
  page, so users can replace `arxiv.org` with our domain in any arXiv URL. Same for `/doi/{doi}`.
- Public paper pages are server-rendered and indexable (SEO is a primary acquisition channel).

### 5.2 iOS app [P2]
Daily habit and triage; phone reading done right.
- Tabs: **Feed**, **Rate**, **Library**, **Profile** (search from Feed header).
- Feed: full-screen vertical paging cards (TikTok-style) for discovery. Each card has a key
  figure, a one-line claim, a note badge, topic, and age. There's a side action rail (Save,
  Notes, Share, More) with optional swipe gestures. Every impression, dwell, save, and skip is
  logged. This is training data for triage.
- Reader: reflowed text, dark mode, font size, tap figure for fullscreen, tap citation for a
  preview sheet, reading progress, offline for saved papers.
- Rate: fast card-based rating of notes (most ratings will come from mobile).
- Library synced with web.
- Push notifications, universal links (web URLs open in app), share sheet.
- Android later via the same Expo codebase (not a launch goal).

### 5.3 Browser extension [P2]
Distribution without asking people to switch tools.
- Injects a small badge on arXiv abstract pages, Google Scholar results, OpenReview, bioRxiv,
  PubMed, and DOI landing pages, e.g. "3 notes, 1 failed reproduction".
- Side panel: notes, rate, add note, save to library.
- Built with WXT (Manifest V3, Chrome first, Firefox/Safari-ready). Auth via bearer token.
- Must be read-only on third-party pages except for the injected badge and panel.

### 5.4 Email [P3]
- Weekly digest: new notes on papers you saved or follow, notes that need your rating, top
  papers in your topics, circle schedule.
- Transactional: sign-in codes, affiliation verification, "a note was added to your paper".

### 5.5 Public API and MCP [P6]
- The same OpenAPI `/v1` surface exposed with API keys and quotas.
- MCP server for agents: search works, get notes with evidence, get verification status.
- Data products: verified notes/results export for organizations.

### 5.6 Admin console [P1 minimal, grows]
Reports queue, moderation actions, author-claim review, institution/domain registry, feature
flags (via PostHog), scoring parameter management, audit log viewer.

## 6. Domain model

Naming: tables are snake_case plural; IDs are UUIDv7 generated in the application layer
(time-sortable, DB-version independent). Every user-generated row has `created_at`,
`updated_at`, and soft-delete `deleted_at`. Brand name never appears in schema.

### 6.1 Scholarly records (global, not user-owned)

**works**: one canonical scholarly work, independent of where it is hosted.
`id, title, abstract, language, work_type (preprint|article|conference_paper|review|book_chapter|dataset|other), published_at, first_seen_at, primary_topic_id, open_access_status, citation_count (cached), canonical_url, merged_into_id (nullable), search_vector (tsvector), embedding (vector, nullable, [P4])`

**work_identifiers**: all external IDs for a work. Unique on `(scheme, value_normalized)`.
`scheme: arxiv | doi | pmid | pmcid | biorxiv | medrxiv | openalex | s2 | openreview | ssrn | other`
This is what makes "any link opens the same page" work, and what allows preprint and published
versions to be linked.

**work_versions**: versions of a work (arXiv v1, v2; preprint vs published version).
`id, work_id, source, version_label, published_at, license (SPDX-like string), license_url, can_display_full_text (derived), pdf_url, html_url, source_url`

**work_redirects**: when two works are merged (duplicate detection, preprint to journal), old
IDs keep resolving. Never hard-delete a work that has notes.

**persons**: people as authors (not app users). `id, display_name, orcid, openalex_id, ...`
**authorships**: `work_id, person_id, position, raw_name, raw_affiliation, institution_id`
**institutions**: keyed by **ROR ID**. `id, ror_id, name, country, email_domains[]`
**topics**: unified taxonomy with source scheme. `id, scheme (arxiv|openalex|mesh|custom), code, name, parent_id`
**work_topics**: `work_id, topic_id, score`
**references**: `citing_work_id, cited_work_id (nullable), raw_citation, position` (resolved lazily)

**reader_documents**: normalized readable version of a work_version.
`id, work_version_id, format (arxiv_html|jats|pdf_only), storage_key, outline (json), figures (json), references (json), pipeline_version, license, generated_at`

### 6.2 Users and identity

**users**: `id, handle (unique), display_name, avatar_key, bio, locale, role (user|moderator|admin), status (active|suspended|deleted), created_at`
Auth tables are owned by the auth library (sessions, accounts, verifications).

**affiliations**: verified or declared links to institutions.
`id, user_id, institution_id, department (text, e.g. "School of EEE"), position (undergrad|masters|phd|postdoc|faculty|staff|industry|other), verification_method (institutional_email|orcid|manual|declared), verified_email_domain, verified_at, expires_at`
Re-verification is required yearly for student positions.

**author_claims**: link a user to a `person`. `user_id, person_id, method (orcid|manual), status (pending|approved|rejected), reviewed_by`

**blocks**: `blocker_id, blocked_id`
**push_tokens**: `user_id, platform, token, device_id, last_seen_at`
**notification_preferences**: per channel and per type.

### 6.3 Personal (private by default)

**library_items**: `user_id, work_id, status (to_read|reading|read|abandoned), saved_at, read_at, progress (json: version, position), source_surface`
**collections**, **collection_items**
**highlights**: private annotations. `user_id, work_version_id, anchor (W3C selectors json), color, comment`

### 6.4 Social [P3, schema may exist earlier]

**takes**: Letterboxd-style short public review. `user_id, work_id, rating (1..5 nullable), body (<=500 chars), visibility (public|followers|circle|private), circle_id`
**follows**: `follower_id, target_type (user|person|topic|work|circle), target_id`
**circles**: `id, type (lab|course|reading_group|custom), name, visibility (private|unlisted|public), institution_id, owner_id`
**circle_members**: `circle_id, user_id, role (owner|admin|member), joined_at`
**circle_sessions**: `circle_id, work_id, scheduled_at, presenter_user_id, notes`
**threads / comments**: private discussion inside circles, and replies under takes.

### 6.5 Community notes

**notes**: `id, work_id, work_version_id, author_user_id, type, body, anchor (json, nullable), status, status_updated_at, scorer_version, origin (direct|promoted_from_take|promoted_from_circle), language`
**note_evidence**: `note_id, kind, url, work_id (if kind=publication), storage_key (if upload), label` (at least one required except `helpful_resource`)
**note_ratings**: `note_id, rater_user_id, value (helpful|somewhat|not_helpful), reasons (text[]), created_at` (unique per note and rater, editable)
**note_status_history**: `note_id, status, scorer_version, computed_at, inputs (json)`
**author_replies**: `note_id, user_id (must have an approved claim on a person who authored the work), body, addressed_in_version`
**scoring_params**: versioned JSON of thresholds, so changes are auditable.

### 6.6 Signals, notifications, trust and safety

**interaction_events**: our own record of behavior (source of truth; PostHog is analytics only).
`id, user_id (nullable), anon_device_id, event_type (impression|open|dwell|save|unsave|skip|not_interested|share|read_progress), work_id, surface (web|ios|extension|email), context (json: feed_request_id, position, ranking_version, reason), dwell_ms, created_at`
Partitioned by month, with a retention policy.

**notifications**: `user_id, type, payload, read_at, channel_status (json)`
**reports**: `reporter_id, target_type, target_id, reason, details, status`
**moderation_actions**: `moderator_id, target_type, target_id, action (hide|remove|restore|warn|suspend|ban), reason`
**audit_log**: append-only for all privileged actions.
**api_keys** [P6]: owned by the auth library's API-key plugin.

## 7. Community notes system (spec)

### 7.1 Note types
| Type | Meaning | Evidence required |
|---|---|---|
| `reproduced` | Ran it, results roughly match | Yes (repo, logs, numbers) |
| `failed_to_reproduce` | Tried, results differ or code fails | Yes |
| `correction` | Error in math, data, claims | Yes |
| `missing_context` | Prior work not cited, important caveat | Yes (citation or link) |
| `code_data_issue` | Leakage, broken code, dataset problem | Yes |
| `helpful_resource` | Better explanation, talk, blog | Link only; shown last |

### 7.2 Anchors
Use the **W3C Web Annotation Data Model** selectors, stored as JSON:
- `TextQuoteSelector` (exact + prefix + suffix, around 32 chars each side)
- `FragmentSelector` (element ID in the reader document, e.g. section, table, or figure ID)
- `TextPositionSelector` (fallback)
Anchors belong to a `work_version`. When a new version appears, try to re-anchor by fuzzy
text-quote match. If that fails, show "anchored to v1". Anchoring logic lives in `packages/core`
and is heavily unit-tested.

### 7.3 Lifecycle
```
draft → NEEDS_MORE_RATINGS → CURRENTLY_RATED_HELPFUL      (shown with badge everywhere)
                           → CURRENTLY_RATED_NOT_HELPFUL  (collapsed, still viewable)
any → WITHDRAWN (by author) | REMOVED (moderation)
```
Status is always derived from ratings by a scorer. Nobody sets it by hand, except moderation
removal. Each computation writes `note_status_history` with `scorer_version`.

### 7.4 Who can write and rate
- **Rate:** any active account with a verified affiliation or linked ORCID.
- **Write:** the same, plus N ratings completed (default 5), configurable. A `bootstrap_mode`
  flag sets N = 0 during seeding.
- **Conflict of interest:** co-authors of the work (via approved author claim) cannot rate
  notes on it. Their ratings are stored but weight 0. The note author cannot rate their own note.

### 7.5 Scorer v0 (simple, launch scale)
```
value: helpful=1.0, somewhat=0.5, not_helpful=0.0
N = eligible ratings, H = mean value
diversity = count of distinct diversity keys among raters with value >= 0.5
diversity key v0 = (institution_id, normalized department)
HELPFUL      if N >= 3 and H >= 0.67 and diversity >= 2
NOT_HELPFUL  if N >= 3 and H <= 0.33
else NEEDS_MORE_RATINGS
```
All thresholds live in `scoring_params`. The diversity key is department-level because at
launch almost everyone is at NTU. Recompute synchronously on each rating, and do a full nightly
recompute.

### 7.6 Scorer v1 [P5]
Bridging-based matrix factorization in the spirit of X's open-source Community Notes algorithm:
a note is helpful only if raters who usually disagree agree. It adds rater helpfulness
(reputation) and runs as a batch job. It must be swappable behind the same `Scorer` interface.

### 7.7 Author reply
One reply per claimed author per note, editable, badged "Author". It can mark "addressed in
vN". Authors are notified when a note is created on their work (if claimed) or when a
claim is later approved.

### 7.8 Where notes come from (contribution ladder)
```
read → save → rate (1 tap) → take (one line) → discuss → community note
```
- A take with evidence can be **promoted** to a note with one click (`origin=promoted_from_take`).
- Circle discussion can be promoted to a public note by its author (`promoted_from_circle`).
- Seeding: founders and early users write the first ~100 notes on papers NTU actually reads.

## 8. Social layer [P3]

- **Reading log:** mark read, optional 1 to 5 rating, optional take.
- **Follows:** users, persons (authors), topics, works (watch for notes and new versions), circles.
- **Circles:** labs, courses, reading groups. Schedule (session, paper, presenter), private
  discussion, shared library, promote-to-note.
- **"Who's reading your paper"** (for claimed authors): aggregate counts only. Institution-level
  breakdown only when 3 or more distinct users from that institution (k-anonymity). Never
  individual names unless the reader opted in.
- **Wrapped** (yearly): papers read, top topics, most-read authors, notes written. Shareable image.
- Privacy defaults: library and reading activity private; takes and notes public; users can
  make reading activity visible to followers.

## 9. Content sources and ingestion

### 9.1 Sources
| Source | Coverage | Access | Full text display | Phase |
|---|---|---|---|---|
| arXiv | CS, physics, math, stats, EE, q-bio | OAI-PMH (nightly incremental), arXiv API (by ID), arXiv HTML pages | Link back always. Display reflowed HTML with attribution. Persist full text only if the license allows (CC). | P0 |
| OpenAlex | ~250M works, all fields; authors, institutions, topics, citations | REST API (CC0 data; check current key/rate-limit terms) | Metadata only | P0 (lookup), P4 (broad) |
| Crossref | Any DOI | REST API with `mailto` (polite pool) | Metadata only | P0 (lookup) |
| Unpaywall | Legal OA copy for a DOI | REST API with email | Link to legal copy | P4 |
| bioRxiv / medRxiv | Bio and medical preprints | Public API; text-mining bucket | Per-paper license | P4 |
| PubMed / PMC | Biomedical | NCBI E-utilities; PMC OA subset (JATS XML) | OA subset: yes, per license | P4 |
| Europe PMC | Biomedical + EU | REST API | Per license | P4 |
| OpenReview | ML conferences and their reviews | API | Per venue terms | P4 |
| Semantic Scholar | Citations, related work | API with key | Metadata | P4 (optional) |
| ChemRxiv, OSF preprints | Chemistry, psychology, social science | APIs | Per license | P4+ |
| Paywalled journals, SSRN | Everything else | Metadata via Crossref/OpenAlex | **Never.** Link out only. | P4 |

### 9.2 Strategy
- **Bulk window + lazy long tail.** Bulk-harvest recent works (start with the last 6 months) for
  seed categories: `cs.AI, cs.LG, cs.CV, cs.CL, cs.RO, cs.HC, eess.SY, eess.SP, eess.IV, stat.ML, q-bio.*`.
  Widen the window when the database budget allows.
- Any other arXiv ID or DOI is **fetched on first request** (lazy ingestion) and then cached.
- Search is **federated**: local full-text search first. If results are weak or the query is an
  ID/DOI, fall back to OpenAlex/Crossref lookups and ingest on click.

### 9.3 Connector interface (`packages/sources`)
```ts
interface SourceConnector {
  id: SourceId
  fetchById(id: ExternalId): Promise<NormalizedWork | null>
  harvestIncremental?(since: Date, sets: string[]): AsyncIterable<NormalizedWork>
  fetchReadable?(version: NormalizedVersion): Promise<RawReadable | null> // html / jats / pdf url
}
```
`NormalizedWork` is source-agnostic. All upserts are idempotent and keyed by `work_identifiers`.
Dedup: exact identifier match first; then DOI-to-arXiv relations (arXiv metadata `doi` field,
OpenAlex `locations`); then [P4] a title+author fuzzy match that goes to a review queue.

### 9.4 Politeness and legal
- arXiv: at most 1 request per 3 seconds, single connection, use `export.arxiv.org` for
  harvesting, set a descriptive User-Agent with a contact email. Display the attribution
  "Thank you to arXiv for use of its open access interoperability." Always link to arXiv for
  the PDF download.
- Store `license` per version. `can_display_full_text` is derived from an allowlist
  (CC-BY, CC-BY-SA, CC0, CC-BY-NC* for non-commercial display, public domain). Everything else
  shows metadata + notes + a link out.
- Never store or serve paywalled PDFs. Never scrape publisher sites.
- Keep a takedown process (email + admin action) and honor it quickly.

## 10. Reader

- **Pipeline** (`packages/reader`, run by the worker, lazily on first open and cached):
  arXiv HTML or JATS XML → sanitize (strict allowlist; MathML allowed; no scripts, no inline
  event handlers, no external iframes) → normalize to **PI Reader Document**: HTML body with
  stable element IDs + JSON outline + figures + references (resolved to works when possible).
  Stored in object storage by `storage_key`. Versioned by `pipeline_version`.
- **Rendering:** web renders the sanitized HTML in the reader component. iOS renders the same
  document in a WebView with injected CSS from design tokens and a message bridge for figure
  taps, citation taps, selection, and progress.
- **PDF fallback:** when no HTML/JATS exists. On iOS, load the source PDF URL directly in a
  native/WebView PDF viewer. On web, use pdf.js. For cross-origin sources, use a stream-through
  proxy with short edge caching and no persistent storage, always showing the source link.
  Review this against source terms before scaling.
- **Math:** MathML native; KaTeX for note bodies.
- **Offline (iOS):** cache reader documents for saved papers.

## 11. Search and feed

### 11.1 Search
Postgres full-text search (weighted: title A, authors B, abstract C) + `pg_trgm` for fuzzy title
matching, with ID/DOI detection first. Hide it behind a `SearchService` interface so it can move to
Typesense/Meilisearch/OpenSearch later without touching callers. [P4] Hybrid with pgvector
embeddings of abstracts.

### 11.2 Feed ranking v0
Candidates:
- (a) new works in followed topics, last 14 days
- (b) works saved/taken by followed users
- (c) works with newly helpful notes in the user's topics
- (d) trending, by save velocity

Score = weighted sum with time decay. Exclude seen/skipped works. At most 2 consecutive cards
from the same topic. Insert a "notes to rate" card about every 8 cards. Every feed response has
a `feed_request_id` and `ranking_version`; impressions and actions are logged against it so
rankers can be evaluated offline later. Ranking lives behind a `FeedRanker` interface.

## 12. Architecture

### 12.1 Shape
```
 Web (Next.js)   iOS (Expo)   Extension (WXT)   Agents/3rd party [P6]
        \             |              |              /
         ───────────  HTTPS /v1  (OpenAPI, typed client)  ───────────
                            API (Hono, Node, TypeScript)
               /            |              |               \
        Postgres      Object storage    Email (Resend)   LLM gateway (budgeted)
    (+pgvector, pg_trgm)   (S3 API: R2)
               \
        Worker (pg-boss queue + cron): ingestion, reader builds, scoring,
        digests, notifications, aggregates
```

### 12.2 Monorepo
```
/
├─ apps/
│  ├─ web/          Next.js (App Router). UI only; calls API.
│  ├─ api/          Hono HTTP API, auth, OpenAPI.
│  ├─ worker/       Job runner (pg-boss), cron schedules.
│  ├─ mobile/       Expo (React Native) iOS app.            [P2]
│  └─ extension/    WXT browser extension.                  [P2]
├─ packages/
│  ├─ core/         Pure domain logic: zod schemas, types, permissions, scoring, anchoring,
│  │                feed ranking. No IO. Most heavily tested package.
│  ├─ db/           Drizzle schema, migrations, seed, query helpers.
│  ├─ api-client/   Typed client generated from the OpenAPI spec (used by all clients).
│  ├─ sources/      Source connectors (arXiv, OpenAlex, Crossref, ...).
│  ├─ reader/       Reader-document pipeline (HTML/JATS → normalized doc).
│  ├─ design-tokens/ Colors, type, spacing, radius, motion → Tailwind theme (web) + RN theme.
│  ├─ emails/       React Email templates.
│  └─ config/       brand.ts, env schemas, tsconfig bases, Biome config.
├─ docs/
│  ├─ CONTEXT.md    (this file)
│  └─ adr/          Architecture Decision Records (0001-*.md ...)
├─ docker-compose.yml  Postgres (pgvector), Mailpit, MinIO (S3-compatible)
└─ .github/workflows/  CI
```

### 12.3 Stack (and why: these are the "no regret" choices)
| Concern | Choice | Why |
|---|---|---|
| Language | TypeScript (strict) everywhere | One language across web, API, worker, iOS, extension; shared types |
| Package mgmt | pnpm workspaces + Turborepo | Standard, fast, cached builds; Expo supports pnpm monorepos |
| Lint/format | Biome | One fast tool |
| Web | Next.js App Router, React Server Components, Tailwind, shadcn/ui (Radix) | SSR/ISR for SEO on paper pages; largest ecosystem; accessible primitives |
| Web data | TanStack Query on the client; server components call the API client | Consistent caching; same client as mobile |
| API | Hono + `@hono/zod-openapi` on Node | Runtime-portable (Node, Bun, Workers); zod schemas become the OpenAPI spec, then typed clients for every surface and the future public API |
| API docs | OpenAPI 3.1 at `/v1/openapi.json` + Scalar UI (non-prod) | Contract-first; the public API later is the same contract |
| DB | Postgres 16+ with `pgvector`, `pg_trgm`, managed (Neon or Supabase, used **only as Postgres**) | Standard SQL only; portable; no vendor SDK in app code |
| ORM | Drizzle + drizzle-kit migrations | Type-safe, SQL-close, good migrations |
| Auth | better-auth (self-hosted inside the API, Drizzle adapter) | Google, Apple, email OTP, organizations, API keys, Expo integration, bearer tokens for extension, OAuth provider for MCP later; no per-MAU fees; no lock-in |
| Jobs | pg-boss in `apps/worker` | Postgres-backed queue and cron; no extra infra; swappable later |
| Object storage | Cloudflare R2 via S3 API (MinIO locally) | Zero egress fees; S3 API keeps it portable |
| Email | Resend + React Email (Mailpit locally) | Simple; templates in TS |
| Mobile | Expo (React Native) + Expo Router + EAS Build/Submit/Update | iOS now, Android later from the same code; OTA updates |
| Mobile UI | NativeWind (Tailwind classes) + Reanimated + Gesture Handler + FlashList + expo-image | Shares tokens with web; performant feed |
| Extension | WXT (MV3) | Cross-browser, Vite-based, good DX |
| AI | Vercel AI SDK behind an internal `llm` module with per-feature budgets and kill switch | Provider-agnostic; cost-capped; optional everywhere |
| Analytics / flags | PostHog (analytics + feature flags) | Free tier; flags needed for staged rollouts |
| Errors | Sentry (web, api, worker, mobile) | Release tracking across surfaces |
| Logging | pino JSON logs with request IDs | Structured, cheap |
| i18n | next-intl (web), i18next + expo-localization (mobile) | English only at launch, but no hardcoded strings from day 1 |
| Testing | Vitest (unit/integration), Playwright (web e2e), Maestro (iOS e2e) | |
| CI | GitHub Actions: typecheck, lint, test, build, migration check | |
| Hosting | Web on Vercel (move to Pro or Cloudflare/OpenNext when commercial); API + worker as Docker containers (Railway/Fly/Render/Hetzner) | Containers keep API portable; no platform-specific APIs in code |

### 12.4 API conventions
- Base path `/v1`. Resources plural. JSON. ISO 8601 UTC timestamps. UUIDv7 string IDs.
- Lists: cursor pagination `?cursor=&limit=` returns `{ data: [...], nextCursor: string | null }`.
- Errors: RFC 9457 `application/problem+json` with `type, title, status, detail, code, requestId`.
- `Idempotency-Key` header supported on all creating POSTs (mobile retries, offline queue).
- ETag / `If-None-Match` on work and reader endpoints.
- Auth: session cookie (web, parent-domain cookie) or `Authorization: Bearer` (mobile,
  extension, API keys). CORS allowlist from env (web origin, extension origin IDs).
- Rate limits per user and per IP; `429` with `Retry-After`.
- Authorization lives in `packages/core` permission functions, enforced in the API. Never in UI only.
- Deprecation via `Deprecation`/`Sunset` headers. Breaking changes mean `/v2`.

### 12.5 Environments
`local` (docker compose) → `preview` (per PR) → `staging` → `production`. Env vars validated at
boot with zod (`packages/config/env`). Secrets never committed. Seed data for local and preview.

### 12.6 Security baseline
- Sanitize all rendered HTML (reader docs, markdown) server-side with an allowlist.
- Strict CSP with nonces on web; security headers.
- SSRF protection for any server-side URL fetch (evidence previews, sources): block private and
  link-local ranges, limit redirects and size.
- Uploads: MIME sniffing, size limits, re-encode images, strip EXIF.
- Least-privilege DB roles; migrations run by a separate role.
- Dependency updates (Renovate/Dependabot), secret scanning, audit log for privileged actions.

### 12.7 Cost envelope (early)
| Item | Early cost |
|---|---|
| Postgres | Free tier to start; about 20 to 25 USD/mo once the bulk window grows |
| API + worker container | about 5 to 10 USD/mo |
| Web hosting | Free (Hobby) during pilot; about 20 USD/mo when commercial |
| R2, Resend, PostHog, Sentry, EAS | Free tiers |
| LLM (optional features) | 0 to 20 USD/mo, hard-capped |
| Apple Developer | already paid; Chrome Web Store 5 USD one-time; domain about 15 USD/yr |
**Rule:** any change that would push monthly cost above 100 USD needs an ADR.

## 13. Design system and UX

- **Feel:** calm, paper-like, typographic. Fast. Quiet chrome, content first.
- **Tokens** (`packages/design-tokens`): color (neutral "paper" and "ink" scales + one accent),
  semantic colors for note types (always paired with icon + label; colorblind-safe), type
  scale, spacing (4 pt grid), radius, elevation, motion durations/easings.
- **Type:** a clean UI sans for chrome; an open-source reading serif for the reader, with a user
  toggle for sans.
- **Light and dark** from day 1. Respect system settings, Dynamic Type (iOS), and Reduce Motion.
- **Accessibility:** WCAG 2.2 AA. Full keyboard navigation on web; VoiceOver labels on iOS.
- **Copy tone:** precise, neutral, friendly. Use "Community note", "Author reply",
  "Needs more ratings". Never use "debunked", "fake", or "exposed".
- **Empty states** always suggest the next action (follow topics, join a circle, rate a note).

## 14. Trust, safety, legal, privacy

- **Policies** (live before public launch): Terms, Privacy Policy, Content Policy, Community
  Notes Guidelines, Takedown process, contact address.
- **Moderation:** report on every UGC item (notes, takes, comments, profiles); block users;
  moderation queue; actions; audit log; appeals by email at first.
- **Pre-submit check (AI, advisory):** flags missing evidence, incivility, or likely misreading
  before a note is posted. The user can still post; moderators see the flag.
- **New-account limits:** rate limits on writes; bootstrap gating (section 7.4).
- **App Store (iOS):** Sign in with Apple when offering Google sign-in; in-app account deletion;
  UGC requirements (filter, report, block, contact info, terms acceptance); privacy manifest and
  accurate privacy labels; no tracking (no IDFA, no ATT prompt).
- **Privacy law:** Singapore PDPA now, GDPR-ready (data export and deletion endpoints from P1).
  Minimum age 13 (review before EU launch).
- **Data promise:** we never sell personal data and never show ads. Aggregates follow the
  k-anonymity rules in section 8.

## 15. Metrics

- North star: **weekly active contributors** (users who rated, took, or noted in the week).
- Supporting: WAU, D7/D30 retention, notes/week by non-founders, ratings per note,
  time-to-first-helpful-note, % of opened papers with at least 1 note, extension installs,
  circles active weekly.
- **90-day pilot bar (NTU):** 200+ weekly users, 100+ notes by non-founders, 3+ active circles
  or courses, at least 1 author reply. If not met, rethink before building further.

## 16. Roadmap

| Phase | Scope | Exit criteria |
|---|---|---|
| **P0 Foundation** | Monorepo, CI, DB schema, API skeleton, auth, arXiv ingestion, reader pipeline v0, design tokens | A paper opens by arXiv ID with reader; sign-in works; CI green |
| **P1 Web MVP** | Paper page, notes + ratings + scorer v0, author reply (manual claims), search, library, rate queue, profiles, affiliation verification, minimal admin, SEO | NTU pilot can use it end to end |
| **P2 iOS + Extension** | iOS: feed, reader, library, rate, push, universal links. Extension: badges + side panel | TestFlight to pilot users; extension on Chrome Web Store |
| **P3 Social** | Takes, follows, circles, weekly digest, ORCID author claims, who's-reading, promote-to-note | Pilot bar in section 15 |
| **P4 Coverage** | OpenAlex broad, bioRxiv/medRxiv, PMC OA, Unpaywall, OpenReview, embeddings | Any DOI opens with metadata; biomed reader via JATS |
| **P5 Trust at scale** | Scorer v1 (bridging), rater reputation, moderation tooling, NUS/SMU expansion | Notes quality stable as raters grow |
| **P6 Platform** | Public API + MCP, team workspaces (billing), data products, Android | Paying teams or API customers |

## 17. Non-goals (say no to these)

- An AI chat assistant as the core product (that's alphaXiv's game, and it's inference-subsidized).
- Hosting paywalled PDFs, scraping publishers, Sci-Hub-style anything.
- Ads, selling data, engagement-bait ranking.
- Building our own LLMs or GPU infrastructure.
- Android at launch (keep it possible, don't build it).
- Peer-review replacement claims. We complement peer review; we don't replace journals.

## 18. Locked-in early decisions (the no-regret list)

1. **Canonical `works` + `work_identifiers` + `work_versions` + redirects.** Every source and
   every URL format maps to one page; preprints and published versions can merge.
2. **W3C Web Annotation selectors for anchors**, scoped to versions.
3. **Separate HTTP API with an OpenAPI contract**, used by every client and later by the public.
4. **Self-hosted auth (better-auth)** with bearer support, organizations, API keys, and an
   OAuth-provider path for MCP.
5. **Standard Postgres only.** Vendor used as hosting, not as SDK.
6. **UUIDv7 IDs** generated in the app.
7. **Brand is configuration.** No "pi" in schema, bundle IDs, package names, or URLs beyond
   the configurable domain. Choose a neutral, permanent iOS bundle identifier (it cannot be
   changed after App Store release).
8. **i18n plumbing from day 1.**
9. **We own interaction data** in our DB (`interaction_events`), not only in analytics tools.
10. **License-aware display** stored per version.
11. **Versioned scoring** with history, behind a `Scorer` interface.
12. **Soft deletes + audit log** for all user content and privileged actions.
13. **Institutions by ROR ID, people by ORCID/OpenAlex.**
14. **Interfaces for swappable subsystems:** `SourceConnector`, `SearchService`, `FeedRanker`,
    `Scorer`, `LlmProvider`, `ObjectStore`, `Mailer`, `JobQueue`.
15. **Containerized API and worker.** Any host works.
16. **iOS payments:** if we ever sell digital subscriptions inside the iOS app, use Apple IAP
    (via RevenueCat). Team plans sold to organizations happen on the web. Review App Store
    guideline 3.1 before building any purchase UI.

## 19. Open questions

- Final name and domain (PI is temporary).
- Diversity key for scorer v0: department vs lab vs circle. Revisit after 50 notes.
- Managed Postgres provider (Neon vs Supabase). Record in an ADR at P0.
- PDF proxy terms per source before scaling beyond pilot.
- Age minimum for EU.
- Moderation staffing as volume grows.
- Apple Developer account is individual. If a company is incorporated, plan the app transfer.

## 20. Glossary

- **Work:** a scholarly item (paper, preprint, chapter) independent of where it's hosted.
- **Version:** a specific release of a work (arXiv v2, journal version of record).
- **Take:** a short public opinion/review (Letterboxd-style). Opinion allowed.
- **Community note:** an evidence-backed note rated by others. Shown only when rated helpful.
- **Circle:** a group (lab, course, reading group) with private discussion and shared library.
- **Person:** an author as they appear in scholarly records. **User:** an app account.
  A user can claim a person.
- **Diversity key:** the dimension used to require agreement across different groups of raters.
