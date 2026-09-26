import type { ExternalId, NormalizedWork, SourceConnector } from "./types.js";

/**
 * docs/CONTEXT.md section 9.3 — OpenAlex connector: fetch-by-DOI on demand, plus a separate
 * enrichment helper (institutions/ROR/topics) for arXiv works that already exist. Verified
 * directly against the real, current API while building this (2026-09-26): `GET
 * /works/https://doi.org/{doi}` resolves a DOI in one call, `mailto` gets the polite-pool rate
 * limit rather than a hard requirement (unlike arXiv's stated 1 req/3s, OpenAlex/Crossref have no
 * CONTEXT.md-mandated interval, so no rate limiter here — just the identifying param).
 */
const OPENALEX_API_BASE = "https://api.openalex.org/works";

// OpenAlex's `primary_location.license` is a short code (verified via a real fetch — e.g.
// "cc-by"), not a URL like the allowlist in license.ts expects. Only codes with an unambiguous
// canonical Creative Commons URL are mapped; everything else (publisher-specific-oa,
// unspecified-oa, in-copyright, etc.) is left unmapped so canDisplayFullText() correctly treats
// it as not-displayable rather than guessing a URL.
const OPENALEX_LICENSE_TO_URL: Record<string, string> = {
  "cc-by": "http://creativecommons.org/licenses/by/4.0/",
  "cc-by-sa": "http://creativecommons.org/licenses/by-sa/4.0/",
  "cc-by-nc": "http://creativecommons.org/licenses/by-nc/4.0/",
  "cc-by-nc-sa": "http://creativecommons.org/licenses/by-nc-sa/4.0/",
  cc0: "http://creativecommons.org/publicdomain/zero/1.0/",
  "public-domain": "http://creativecommons.org/publicdomain/mark/1.0/",
};

const OPENALEX_TYPE_TO_WORK_TYPE: Record<string, NormalizedWork["workType"]> = {
  article: "article",
  "journal-article": "article",
  preprint: "preprint",
  "conference-paper": "conference_paper",
  review: "review",
  "book-chapter": "book_chapter",
  dataset: "dataset",
};

export interface OpenAlexConnectorConfig {
  contactEmail: string;
  productName: string;
  /** Injectable for tests — real fixture responses, no live network. */
  fetchImpl?: typeof fetch;
}

interface OpenAlexAuthorship {
  author_position: string;
  author: { id: string; display_name: string; orcid?: string };
  institutions: { id: string; display_name: string; ror?: string; country_code?: string }[];
  raw_author_name: string;
}

interface OpenAlexTopic {
  id: string;
  display_name: string;
  score: number;
}

interface OpenAlexWork {
  id: string;
  doi?: string;
  ids?: { openalex: string; doi?: string; pmid?: string; mag?: string };
  title: string;
  type: string;
  language?: string;
  publication_date?: string;
  authorships: OpenAlexAuthorship[];
  topics?: OpenAlexTopic[];
  primary_topic?: OpenAlexTopic;
  abstract_inverted_index?: Record<string, number[]>;
  primary_location?: {
    license?: string;
    pdf_url?: string;
    landing_page_url?: string;
  };
  best_oa_location?: {
    pdf_url?: string;
    landing_page_url?: string;
  };
}

/** OpenAlex doesn't return a plain abstract string — it returns a word -> positions inverted
 * index (verified via a real fetch), presumably for copyright reasons. Reconstructs the original
 * word order from it. */
function reconstructAbstract(index: Record<string, number[]> | undefined): string | null {
  if (!index) return null;
  const words: string[] = [];
  for (const [word, positions] of Object.entries(index)) {
    for (const position of positions) {
      words[position] = word;
    }
  }
  return words.join(" ").trim() || null;
}

function stripDoiUrl(doi: string): string {
  return doi.replace(/^https?:\/\/doi\.org\//i, "").toLowerCase();
}

export function normalizeOpenAlexWork(raw: OpenAlexWork): NormalizedWork {
  const workType = OPENALEX_TYPE_TO_WORK_TYPE[raw.type] ?? "other";
  const publishedAt = raw.publication_date ? new Date(raw.publication_date) : null;
  const licenseCode = raw.primary_location?.license;
  const licenseUrl = licenseCode ? (OPENALEX_LICENSE_TO_URL[licenseCode] ?? null) : null;
  const pdfUrl = raw.primary_location?.pdf_url ?? raw.best_oa_location?.pdf_url ?? null;
  const sourceUrl =
    raw.primary_location?.landing_page_url ?? raw.best_oa_location?.landing_page_url ?? null;

  const identifiers: NormalizedWork["identifiers"] = [
    { scheme: "openalex", valueNormalized: raw.id, valueRaw: raw.id },
  ];
  const doi = raw.doi ?? raw.ids?.doi;
  if (doi) {
    const normalized = stripDoiUrl(doi);
    identifiers.push({ scheme: "doi", valueNormalized: normalized, valueRaw: doi });
  }
  if (raw.ids?.pmid) {
    identifiers.push({
      scheme: "pmid",
      valueNormalized: raw.ids.pmid
        .replace(/^https?:\/\/pubmed\.ncbi\.nlm\.nih\.gov\//i, "")
        .replace(/\/$/, ""),
      valueRaw: raw.ids.pmid,
    });
  }

  return {
    title: raw.title,
    abstract: reconstructAbstract(raw.abstract_inverted_index),
    language: raw.language ?? null,
    workType,
    publishedAt,
    identifiers,
    authors: raw.authorships.map((a, index) => ({
      name: a.raw_author_name,
      orcid: a.author.orcid?.replace(/^https?:\/\/orcid\.org\//i, ""),
      position: index + 1,
    })),
    categories: (raw.topics ?? []).map((t) => t.display_name),
    version: {
      source: "openalex",
      versionLabel: "v1",
      publishedAt,
      license: licenseCode ?? null,
      licenseUrl,
      pdfUrl,
      htmlUrl: sourceUrl,
      sourceUrl,
    },
  };
}

export interface OpenAlexEnrichmentTopic {
  code: string;
  name: string;
  score: number;
}

export interface OpenAlexEnrichmentInstitution {
  rorId: string;
  name: string;
  country: string | null;
}

/** Which author (by 1-based position, matching NormalizedAuthor.position) is affiliated with
 * which of `institutions`' ROR ids — needed to set `authorships.institutionId` per-author rather
 * than just knowing the work's institution set as an undifferentiated bag. */
export interface OpenAlexEnrichmentAuthorInstitutions {
  position: number;
  rorIds: string[];
}

/** docs/CONTEXT.md section 9.3 — "enrich arXiv works with OpenAlex IDs/ROR institutions/topics
 * when available." Deliberately a separate shape from NormalizedWork: this is additive metadata
 * merged onto an already-ingested work, not a full re-normalization. */
export interface OpenAlexEnrichment {
  openalexId: string;
  topics: OpenAlexEnrichmentTopic[];
  institutions: OpenAlexEnrichmentInstitution[];
  authorInstitutions: OpenAlexEnrichmentAuthorInstitutions[];
}

function toEnrichment(raw: OpenAlexWork): OpenAlexEnrichment {
  const institutionsById = new Map<string, OpenAlexEnrichmentInstitution>();
  const authorInstitutions: OpenAlexEnrichmentAuthorInstitutions[] = [];

  raw.authorships.forEach((authorship, index) => {
    const rorIds: string[] = [];
    for (const institution of authorship.institutions) {
      if (!institution.ror) continue; // CONTEXT.md's institutions table is "keyed by ROR ID" — skip unrorred ones
      institutionsById.set(institution.ror, {
        rorId: institution.ror,
        name: institution.display_name,
        country: institution.country_code ?? null,
      });
      rorIds.push(institution.ror);
    }
    authorInstitutions.push({ position: index + 1, rorIds });
  });

  return {
    openalexId: raw.id,
    topics: (raw.topics ?? []).map((t) => ({
      code: t.id.replace(/^https?:\/\/openalex\.org\//i, ""),
      name: t.display_name,
      score: t.score,
    })),
    institutions: [...institutionsById.values()],
    authorInstitutions,
  };
}

export function createOpenAlexConnector(config: OpenAlexConnectorConfig): SourceConnector {
  const fetchImpl = config.fetchImpl ?? fetch;
  const userAgent = `${config.productName} (mailto:${config.contactEmail})`;

  async function fetchRaw(doi: string): Promise<OpenAlexWork | null> {
    const url = `${OPENALEX_API_BASE}/https://doi.org/${encodeURIComponent(doi)}?mailto=${encodeURIComponent(config.contactEmail)}`;
    const res = await fetchImpl(url, { headers: { "User-Agent": userAgent } });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`OpenAlex API request failed: ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as OpenAlexWork;
  }

  async function fetchById(id: ExternalId): Promise<NormalizedWork | null> {
    if (id.scheme !== "doi") return null;
    const raw = await fetchRaw(id.value);
    if (!raw) return null;
    return normalizeOpenAlexWork(raw);
  }

  return { id: "openalex", fetchById };
}

/** Standalone (not part of the SourceConnector interface, which only models fetch-by-id and
 * incremental harvest) since enrichment is applied to a work that's already been ingested, keyed
 * by a DOI already on file — CONTEXT.md's "enrich arXiv works ... when available" flow. */
export async function fetchOpenAlexEnrichment(
  doi: string,
  config: OpenAlexConnectorConfig,
): Promise<OpenAlexEnrichment | null> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const userAgent = `${config.productName} (mailto:${config.contactEmail})`;
  const url = `${OPENALEX_API_BASE}/https://doi.org/${encodeURIComponent(doi)}?mailto=${encodeURIComponent(config.contactEmail)}`;
  const res = await fetchImpl(url, { headers: { "User-Agent": userAgent } });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`OpenAlex API request failed: ${res.status} ${res.statusText}`);
  }
  const raw = (await res.json()) as OpenAlexWork;
  return toEnrichment(raw);
}
