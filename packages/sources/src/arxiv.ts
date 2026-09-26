import { parseArxivId } from "@repo/core";
import { XMLParser } from "fast-xml-parser";
import { createRateLimiter } from "./rate-limiter.js";
import type { ExternalId, NormalizedWork, SourceConnector } from "./types.js";

/**
 * docs/CONTEXT.md section 9.1/9.4 — arXiv connector. Endpoints verified directly against the
 * real, current API while building this (2026-09-25/26), not assumed from memory or docs that
 * might be stale:
 * - `export.arxiv.org/api/query` (Atom, single-work lookup) still works as documented.
 * - `export.arxiv.org/oai2` (OAI-PMH harvesting) now 301-redirects to `oaipmh.arxiv.org/oai` —
 *   this connector uses the new host directly rather than following a redirect on every
 *   harvest request.
 */
const ARXIV_API_BASE = "https://export.arxiv.org/api/query";
const ARXIV_OAI_BASE = "https://oaipmh.arxiv.org/oai";

// docs/CONTEXT.md section 9.4: "at most 1 request per 3 seconds, single connection" — shared
// across every call this connector makes, not per-method, since it's one real connection.
const schedule = createRateLimiter(3_000);

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  // Without this, fast-xml-parser coerces numeric-looking text to JS numbers — verified
  // directly that this corrupts arXiv ids (e.g. the literal string "2309.10164" silently
  // becomes the number 2309.10164, which reformats/loses precision for other ids). Every field
  // here is read and used as a string; numeric fields we actually want as numbers
  // (opensearch:totalResults) are parsed explicitly below instead.
  parseTagValue: false,
});

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

export interface ArxivConnectorConfig {
  /** docs/CONTEXT.md section 9.4: "descriptive User-Agent with a contact email from env." */
  contactEmail: string;
  productName: string;
  /** Injectable for tests — real fixture responses, no live network. */
  fetchImpl?: typeof fetch;
}

interface AtomEntry {
  id: string;
  title: string;
  summary: string;
  published: string;
  link?:
    | { "@_href": string; "@_rel": string; "@_title"?: string }[]
    | { "@_href": string; "@_rel": string; "@_title"?: string };
  category?: { "@_term": string }[] | { "@_term": string };
  author?: { name: string }[] | { name: string };
}

function normalizeAtomEntry(entry: AtomEntry): NormalizedWork | null {
  const parsed = parseArxivId(entry.id);
  if (!parsed) return null;

  const links = asArray(entry.link);
  const htmlLink = links.find((l) => l["@_rel"] === "alternate");
  const pdfLink = links.find((l) => l["@_title"] === "pdf");
  const categories = asArray(entry.category).map((c) => c["@_term"]);
  const authors = asArray(entry.author).map((a, index) => ({ name: a.name, position: index + 1 }));
  const publishedAt = entry.published ? new Date(entry.published) : null;

  return {
    title: entry.title.trim(),
    abstract: entry.summary?.trim().replace(/\s+/g, " ") ?? null,
    language: null,
    workType: "preprint",
    publishedAt,
    identifiers: [{ scheme: "arxiv", valueNormalized: parsed.normalized, valueRaw: entry.id }],
    authors,
    categories,
    version: {
      source: "arxiv",
      versionLabel: parsed.version ? `v${parsed.version}` : "v1",
      publishedAt,
      // Not available via the Atom API — verified directly (a real fetch of this endpoint has
      // no license field). Only harvestIncremental (OAI-PMH arXivRaw) carries it.
      license: null,
      licenseUrl: null,
      pdfUrl: pdfLink?.["@_href"] ?? null,
      htmlUrl: htmlLink?.["@_href"] ?? null,
      sourceUrl: htmlLink?.["@_href"] ?? null,
    },
  };
}

interface OaiRecord {
  header: { identifier: string; datestamp: string };
  metadata?: {
    arXivRaw: {
      id: string;
      title: string;
      authors: string;
      categories: string;
      abstract: string;
      license?: string;
      doi?: string;
      version: { "@_version": string; date: string }[] | { "@_version": string; date: string };
    };
  };
}

function normalizeOaiRecord(record: OaiRecord): NormalizedWork | null {
  const raw = record.metadata?.arXivRaw;
  if (!raw) return null; // deleted records carry only a header — nothing to normalize

  const versions = asArray(raw.version);
  const latestVersion = versions.at(-1);
  const versionLabel = latestVersion?.["@_version"] ?? "v1";
  const publishedAt = latestVersion?.date ? new Date(latestVersion.date) : null;
  const categories = raw.categories.split(/\s+/).filter(Boolean);
  const authors = raw.authors
    .split(",")
    .map((name, index) => ({ name: name.trim(), position: index + 1 }));
  const licenseUrl = raw.license ?? null;

  const identifiers: NormalizedWork["identifiers"] = [
    { scheme: "arxiv", valueNormalized: raw.id, valueRaw: raw.id },
  ];
  if (raw.doi) {
    identifiers.push({ scheme: "doi", valueNormalized: raw.doi.toLowerCase(), valueRaw: raw.doi });
  }

  return {
    title: raw.title.trim(),
    abstract: raw.abstract?.trim().replace(/\s+/g, " ") ?? null,
    language: null,
    workType: "preprint",
    publishedAt,
    identifiers,
    authors,
    categories,
    version: {
      source: "arxiv",
      versionLabel,
      publishedAt,
      license: licenseUrl,
      licenseUrl,
      pdfUrl: `https://arxiv.org/pdf/${raw.id}`,
      htmlUrl: `https://arxiv.org/abs/${raw.id}`,
      sourceUrl: `https://arxiv.org/abs/${raw.id}`,
    },
  };
}

/** arXiv's OAI set naming for a category code — verified directly against the live API for
 * cs.RO, stat.ML, and q-bio.GN (the format holds for hyphenated archive names like "q-bio"
 * too): `{archive}:{archive}:{subject}`. */
function categoryToOaiSet(category: string): string {
  const [archive, subject] = category.split(".");
  return `${archive}:${archive}:${subject}`;
}

export function createArxivConnector(config: ArxivConnectorConfig): SourceConnector {
  const fetchImpl = config.fetchImpl ?? fetch;
  const userAgent = `${config.productName} (mailto:${config.contactEmail})`;

  async function fetchById(id: ExternalId): Promise<NormalizedWork | null> {
    if (id.scheme !== "arxiv") return null;

    return schedule(async () => {
      const url = `${ARXIV_API_BASE}?id_list=${encodeURIComponent(id.value)}`;
      const res = await fetchImpl(url, { headers: { "User-Agent": userAgent } });
      if (!res.ok) {
        throw new Error(`arXiv API request failed: ${res.status} ${res.statusText}`);
      }
      const xml = await res.text();
      const parsed = xmlParser.parse(xml) as { feed?: { entry?: AtomEntry } };
      if (!parsed.feed?.entry) return null;
      return normalizeAtomEntry(parsed.feed.entry);
    });
  }

  async function* harvestIncremental(since: Date, sets: string[]): AsyncIterable<NormalizedWork> {
    const fromDate = since.toISOString().slice(0, 10);

    for (const category of sets) {
      const set = categoryToOaiSet(category);
      let resumptionToken: string | undefined;

      do {
        const page = await schedule(async () => {
          const url = resumptionToken
            ? `${ARXIV_OAI_BASE}?verb=ListRecords&resumptionToken=${encodeURIComponent(resumptionToken as string)}`
            : `${ARXIV_OAI_BASE}?verb=ListRecords&metadataPrefix=arXivRaw&set=${encodeURIComponent(set)}&from=${fromDate}`;
          const res = await fetchImpl(url, { headers: { "User-Agent": userAgent } });
          if (!res.ok) {
            throw new Error(`arXiv OAI-PMH request failed: ${res.status} ${res.statusText}`);
          }
          const xml = await res.text();
          return xmlParser.parse(xml) as {
            "OAI-PMH": {
              ListRecords?: {
                record?: OaiRecord[] | OaiRecord;
                resumptionToken?: string | { "#text"?: string };
              };
              error?: { "@_code": string; "#text"?: string };
            };
          };
        });

        const listRecords = page["OAI-PMH"].ListRecords;
        if (!listRecords) break; // e.g. noRecordsMatch — nothing for this set/window

        for (const record of asArray(listRecords.record)) {
          const work = normalizeOaiRecord(record);
          if (work) yield work;
        }

        const token = listRecords.resumptionToken;
        resumptionToken =
          typeof token === "string" ? token || undefined : (token?.["#text"] ?? undefined);
      } while (resumptionToken);
    }
  }

  return { id: "arxiv", fetchById, harvestIncremental };
}
