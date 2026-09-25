const PUBMED_URL = /^https?:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)\/?(?:[?#].*)?$/i;
const PMID_PREFIXED = /^pmid:\s*(\d+)$/i;

/** Parses a PMID from a PubMed URL or a "PMID:"-prefixed value. Deliberately does NOT treat a
 * bare number as a PMID — plain digits are too ambiguous (could be almost anything) to guess at
 * without an explicit "pmid:" marker or PubMed URL. */
export function parsePmid(input: string): string | null {
  const trimmed = input.trim();

  // Group 1 is mandatory in both patterns, so a match guarantees it's set.
  const urlMatch = trimmed.match(PUBMED_URL);
  if (urlMatch) return urlMatch[1] as string;

  const prefixMatch = trimmed.match(PMID_PREFIXED);
  if (prefixMatch) return prefixMatch[1] as string;

  return null;
}
