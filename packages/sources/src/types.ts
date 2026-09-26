import type { ExternalIdScheme } from "@repo/core";

/**
 * docs/CONTEXT.md section 9.3 — "`NormalizedWork` is source-agnostic. All upserts are idempotent
 * and keyed by `work_identifiers`."
 */
export interface NormalizedIdentifier {
  scheme: ExternalIdScheme | "openalex" | "s2";
  valueNormalized: string;
  valueRaw: string;
}

export interface NormalizedAuthor {
  name: string;
  orcid?: string;
  position: number;
}

export interface NormalizedVersion {
  source: SourceId;
  versionLabel: string;
  publishedAt: Date | null;
  license: string | null;
  licenseUrl: string | null;
  pdfUrl: string | null;
  htmlUrl: string | null;
  sourceUrl: string | null;
}

export interface NormalizedWork {
  title: string;
  abstract: string | null;
  language: string | null;
  workType:
    | "preprint"
    | "article"
    | "conference_paper"
    | "review"
    | "book_chapter"
    | "dataset"
    | "other";
  publishedAt: Date | null;
  identifiers: NormalizedIdentifier[];
  authors: NormalizedAuthor[];
  /** arXiv-taxonomy category codes (e.g. "cs.LG") — only codes already in packages/db's seeded
   * `topics` get linked (docs/adr/0005's reasoning extends here); others are recorded on the
   * work but not linked to a `topics` row. */
  categories: string[];
  version: NormalizedVersion;
}

export type SourceId =
  | "arxiv"
  | "openalex"
  | "crossref"
  | "unpaywall"
  | "biorxiv"
  | "medrxiv"
  | "pubmed"
  | "pmc"
  | "europepmc"
  | "semanticscholar"
  | "openreview"
  | "chemrxiv"
  | "osf"
  | "other";

export interface ExternalId {
  scheme: ExternalIdScheme;
  value: string;
}

/** docs/CONTEXT.md section 9.3. `fetchReadable` is M5's concern (packages/reader) — omitted
 * here, not stubbed. */
export interface SourceConnector {
  id: SourceId;
  fetchById(id: ExternalId): Promise<NormalizedWork | null>;
  harvestIncremental?(since: Date, sets: string[]): AsyncIterable<NormalizedWork>;
}
