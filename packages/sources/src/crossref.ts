import type { ExternalId, NormalizedWork, SourceConnector } from "./types.js";

/**
 * docs/CONTEXT.md section 9.3/9.4 — Crossref connector: fetch-by-DOI on demand, `mailto` param
 * for the polite pool (the section's explicit ask). Verified directly against the real, current
 * API while building this (2026-09-26): `GET /works/{doi}?mailto=...` resolves a DOI in one call;
 * an unknown DOI returns HTTP 404 with a plain-text body ("Resource not found."), not JSON.
 */
const CROSSREF_API_BASE = "https://api.crossref.org/works";

const CROSSREF_TYPE_TO_WORK_TYPE: Record<string, NormalizedWork["workType"]> = {
  "journal-article": "article",
  "proceedings-article": "conference_paper",
  "posted-content": "preprint",
  "book-chapter": "book_chapter",
  dataset: "dataset",
  "peer-review": "review",
};

interface CrossrefDatePart {
  "date-parts": [number, number?, number?][];
}

interface CrossrefAuthor {
  given?: string;
  family?: string;
  name?: string; // organizational authors sometimes carry only `name`
  ORCID?: string;
  sequence: string;
}

interface CrossrefLicense {
  URL: string;
  "content-version": string;
}

interface CrossrefLink {
  URL: string;
  "content-type": string;
  "intended-application": string;
}

interface CrossrefWork {
  DOI: string;
  title?: string[];
  abstract?: string;
  type: string;
  language?: string;
  "container-title"?: string[];
  published?: CrossrefDatePart;
  "published-print"?: CrossrefDatePart;
  "published-online"?: CrossrefDatePart;
  author?: CrossrefAuthor[];
  license?: CrossrefLicense[];
  link?: CrossrefLink[];
  URL?: string;
}

interface CrossrefResponse {
  status: string;
  message: CrossrefWork;
}

export interface CrossrefConnectorConfig {
  contactEmail: string;
  productName: string;
  /** Injectable for tests — real fixture responses, no live network. */
  fetchImpl?: typeof fetch;
}

function datePartsToDate(part: CrossrefDatePart | undefined): Date | null {
  const parts = part?.["date-parts"]?.[0];
  if (!parts) return null;
  const [year, month, day] = parts;
  if (!year) return null;
  return new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
}

/** Crossref abstracts are JATS XML fragments (verified via a real fetch — e.g.
 * `<jats:p>...</jats:p>`), not plain text. Strips tags rather than pulling in a full JATS parser
 * for what's typically a handful of <jats:p>/<jats:italic>-style elements. */
function stripJatsTags(abstract: string | undefined): string | null {
  if (!abstract) return null;
  const text = abstract
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

/** Prefers a Creative Commons license (matches license.ts's allowlist shape) among the several
 * per-content-version entries Crossref returns (verified via a real fetch — vor/am/tdm each carry
 * their own license row, often identical URLs); falls back to the first entry, or null. */
function pickLicenseUrl(licenses: CrossrefLicense[] | undefined): string | null {
  if (!licenses || licenses.length === 0) return null;
  const cc = licenses.find((l) => /creativecommons\.org/i.test(l.URL));
  return (cc ?? licenses[0])?.URL ?? null;
}

function pickPdfUrl(links: CrossrefLink[] | undefined): string | null {
  return links?.find((l) => l["content-type"] === "application/pdf")?.URL ?? null;
}

export function normalizeCrossrefWork(raw: CrossrefWork): NormalizedWork {
  const workType = CROSSREF_TYPE_TO_WORK_TYPE[raw.type] ?? "other";
  const publishedAt =
    datePartsToDate(raw.published) ??
    datePartsToDate(raw["published-print"]) ??
    datePartsToDate(raw["published-online"]);
  const licenseUrl = pickLicenseUrl(raw.license);
  const doi = raw.DOI.toLowerCase();

  return {
    title: raw.title?.[0]?.trim() ?? "",
    abstract: stripJatsTags(raw.abstract),
    language: raw.language ?? null,
    workType,
    publishedAt,
    identifiers: [{ scheme: "doi", valueNormalized: doi, valueRaw: raw.DOI }],
    authors: (raw.author ?? []).map((a, index) => ({
      name: a.name ?? [a.given, a.family].filter(Boolean).join(" "),
      orcid: a.ORCID?.replace(/^https?:\/\/orcid\.org\//i, ""),
      position: index + 1,
    })),
    categories: raw["container-title"] ?? [],
    version: {
      source: "crossref",
      versionLabel: "v1",
      publishedAt,
      license: licenseUrl,
      licenseUrl,
      pdfUrl: pickPdfUrl(raw.link),
      htmlUrl: raw.URL ?? null,
      sourceUrl: raw.URL ?? null,
    },
  };
}

export function createCrossrefConnector(config: CrossrefConnectorConfig): SourceConnector {
  const fetchImpl = config.fetchImpl ?? fetch;
  const userAgent = `${config.productName} (mailto:${config.contactEmail})`;

  async function fetchById(id: ExternalId): Promise<NormalizedWork | null> {
    if (id.scheme !== "doi") return null;

    const url = `${CROSSREF_API_BASE}/${encodeURIComponent(id.value)}?mailto=${encodeURIComponent(config.contactEmail)}`;
    const res = await fetchImpl(url, { headers: { "User-Agent": userAgent } });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`Crossref API request failed: ${res.status} ${res.statusText}`);
    }
    const body = (await res.json()) as CrossrefResponse;
    return normalizeCrossrefWork(body.message);
  }

  return { id: "crossref", fetchById };
}
