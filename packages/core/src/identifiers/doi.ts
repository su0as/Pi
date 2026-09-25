const DOI_URL = /^https?:\/\/(?:dx\.)?doi\.org\/(.+)$/i;

/** DOI prefix "10." + a 4-9 digit registrant code + "/" + a non-space suffix — the shape defined
 * by the DOI Handbook, not something CONTEXT.md needed to specify further. */
const BARE_DOI = /^10\.\d{4,9}\/\S+$/i;

/** Parses a DOI from a bare DOI, a "doi:"-prefixed DOI, or a doi.org/dx.doi.org URL. DOIs are
 * case-insensitive, so the normalized form is lowercased — CONTEXT.md's "DOI lowercasing and
 * prefix stripping." Returns null if `input` doesn't look like a DOI. */
export function parseDoi(input: string): string | null {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(DOI_URL);

  let candidate: string;
  if (urlMatch?.[1]) {
    try {
      candidate = decodeURIComponent(urlMatch[1]);
    } catch {
      candidate = urlMatch[1];
    }
  } else {
    candidate = trimmed.replace(/^doi:\s*/i, "");
  }

  return BARE_DOI.test(candidate) ? candidate.toLowerCase() : null;
}
