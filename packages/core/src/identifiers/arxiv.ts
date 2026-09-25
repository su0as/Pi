/** New-style arXiv ID (2007+): YYMM.NNNNN, optionally NNNNNN, optional version suffix. */
const NEW_ARXIV_ID = /^(\d{4}\.\d{4,6})(?:v(\d+))?$/;

/** Old-style arXiv ID (pre-2007): archive[.subject-class]/YYMMNNN, optional version suffix.
 * e.g. "hep-th/9901001", "math.GT/0309136". */
const OLD_ARXIV_ID = /^([a-z-]+(?:\.[A-Za-z-]+)?\/\d{7})(?:v(\d+))?$/i;

const ARXIV_URL =
  /^https?:\/\/(?:www\.)?arxiv\.org\/(?:abs|pdf|html)\/([^\s?#]+?)(?:\.pdf)?\/?(?:[?#].*)?$/i;

export interface ParsedArxivId {
  /** Version-stripped, lowercased — this is what work_identifiers.value_normalized stores. */
  normalized: string;
  /** The version suffix if one was present, else null. */
  version: number | null;
}

/** Parses an arXiv ID from a bare ID, an "arXiv:"-prefixed ID, or an arxiv.org URL
 * (/abs/, /pdf/, or /html/). Returns null if `input` doesn't look like an arXiv identifier. */
export function parseArxivId(input: string): ParsedArxivId | null {
  const trimmed = input.trim();

  const urlMatch = trimmed.match(ARXIV_URL);
  const idPart = urlMatch ? urlMatch[1] : trimmed.replace(/^arxiv:\s*/i, "");
  if (!idPart) return null;

  const newMatch = idPart.match(NEW_ARXIV_ID);
  if (newMatch) {
    // Group 1 is mandatory in NEW_ARXIV_ID (not inside `?`), so a match guarantees it's set.
    return {
      normalized: newMatch[1] as string,
      version: newMatch[2] ? Number(newMatch[2]) : null,
    };
  }

  const oldMatch = idPart.match(OLD_ARXIV_ID);
  if (oldMatch) {
    // Same reasoning: group 1 is mandatory in OLD_ARXIV_ID.
    return {
      normalized: (oldMatch[1] as string).toLowerCase(),
      version: oldMatch[2] ? Number(oldMatch[2]) : null,
    };
  }

  return null;
}
