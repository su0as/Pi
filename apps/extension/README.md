# apps/extension (placeholder — P2)

Not built yet. Per `docs/CONTEXT.md` section 5.3 and the roadmap in section 16, this becomes a
WXT (Manifest V3) browser extension, Chrome first with Firefox/Safari readiness, authenticating
via a bearer token against the same `/v1` API used by every other client.

Scope when P2 starts: a badge injected on arXiv abstract pages, Google Scholar results,
OpenReview, bioRxiv, PubMed, and DOI landing pages (e.g. "3 notes, 1 failed reproduction"), plus a
side panel for notes/rate/add-note/save-to-library. Must stay read-only on third-party pages
except for the injected badge and panel.

Do not start building here until P0/P1 (`apps/web`, `apps/api`) are stable — see
`PROMPT_01_WEB.md`'s milestone sequencing.
