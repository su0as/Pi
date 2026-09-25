import { parseArxivId } from "./arxiv.js";
import { parseDoi } from "./doi.js";
import { parsePmid } from "./pmid.js";

export type ExternalIdScheme = "arxiv" | "doi" | "pmid";

export interface ParsedExternalId {
  scheme: ExternalIdScheme;
  /** Goes in work_identifiers.value_normalized — the unique-indexed lookup key. */
  valueNormalized: string;
  /** Goes in work_identifiers.value_raw — what the user/source actually gave us. */
  valueRaw: string;
}

/** Detects and normalizes an arXiv ID/URL, DOI/URL, or PMID/PubMed URL from free-form input —
 * what CONTEXT.md section 11.1 calls "ID/DOI detection first" in search, and what
 * `GET /v1/works/resolve` (M4) uses to decide whether to look up an existing work or ingest a
 * new one. Returns null when `input` doesn't match any known identifier shape, so the caller
 * falls back to treating it as a plain search query. */
export function parseExternalId(input: string): ParsedExternalId | null {
  const raw = input.trim();
  if (!raw) return null;

  const doi = parseDoi(raw);
  if (doi) {
    return { scheme: "doi", valueNormalized: doi, valueRaw: raw };
  }

  const arxiv = parseArxivId(raw);
  if (arxiv) {
    return { scheme: "arxiv", valueNormalized: arxiv.normalized, valueRaw: raw };
  }

  const pmid = parsePmid(raw);
  if (pmid) {
    return { scheme: "pmid", valueNormalized: pmid, valueRaw: raw };
  }

  return null;
}
