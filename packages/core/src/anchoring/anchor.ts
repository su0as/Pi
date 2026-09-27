/**
 * docs/CONTEXT.md section 7.2 — W3C Web Annotation Data Model selectors, stored as JSON on
 * `notes.anchor`. This package only ever works with plain extracted text and offsets, never a
 * live DOM `Range` — the browser (apps/web) is what turns a user's selection into a
 * `documentText`/`start`/`end` triple before calling `createAnchor`, and what turns
 * `TextQuoteSelector` back into a live `Range` after calling `resolveAnchor`. Keeping the DOM out
 * of this package is what makes "heavily unit-tested" (CONTEXT.md's own words) practical.
 *
 * These types live in this file (rather than a sibling `types.ts`) so that `@repo/core/anchoring`
 * has no internal cross-file relative import: Turbopack's `transpilePackages` doesn't replicate
 * Node/tsx's NodeNext mapping of a `./foo.js` specifier to a sibling `./foo.ts` file, so a
 * multi-file split here would fail to bundle for the browser even though it resolves fine under
 * tsx (see ADR-0006).
 */
export interface TextQuoteSelector {
  type: "TextQuoteSelector";
  exact: string;
  prefix: string;
  suffix: string;
}

export interface TextPositionSelector {
  type: "TextPositionSelector";
  start: number;
  end: number;
}

export interface FragmentSelector {
  type: "FragmentSelector";
  /** An element id in the reader document — e.g. a section, table, or figure id. */
  value: string;
}

export interface Anchor {
  textQuote: TextQuoteSelector;
  /** Fallback for when a fuzzy text-quote re-match fails entirely. */
  textPosition: TextPositionSelector;
  /** Which containing element the selection fell within, if any — narrows the fuzzy re-match
   * search space and is shown to the user (e.g. "in Section 3") even when re-anchoring fails. */
  fragment: FragmentSelector | null;
}

export interface ResolvedAnchor {
  start: number;
  end: number;
}

const CONTEXT_LENGTH = 32; // docs/CONTEXT.md section 7.2: "around 32 chars each side"

/**
 * docs/CONTEXT.md section 7.2 — builds the three selectors from a plain-text selection. `start`/
 * `end` are character offsets into `documentText` (the reader document's full extracted text, as
 * the browser's `Range`-to-offset conversion produces it — apps/web's job, not this package's).
 */
export function createAnchor(
  documentText: string,
  start: number,
  end: number,
  fragmentId: string | null = null,
): Anchor {
  if (start < 0 || end > documentText.length || start >= end) {
    throw new Error(
      `createAnchor: invalid range [${start}, ${end}) for a ${documentText.length}-char document`,
    );
  }

  const textQuote: TextQuoteSelector = {
    type: "TextQuoteSelector",
    exact: documentText.slice(start, end),
    prefix: documentText.slice(Math.max(0, start - CONTEXT_LENGTH), start),
    suffix: documentText.slice(end, end + CONTEXT_LENGTH),
  };

  const fragment: FragmentSelector | null = fragmentId
    ? { type: "FragmentSelector", value: fragmentId }
    : null;

  return {
    textQuote,
    textPosition: { type: "TextPositionSelector", start, end },
    fragment,
  };
}

function allIndicesOf(haystack: string, needle: string): number[] {
  if (!needle) return [];
  const indices: number[] = [];
  let from = 0;
  for (;;) {
    const index = haystack.indexOf(needle, from);
    if (index === -1) break;
    indices.push(index);
    from = index + 1; // allow overlapping matches
  }
  return indices;
}

/** How well `documentText`'s actual surroundings at a candidate match location agree with the
 * anchor's recorded prefix/suffix — used only to disambiguate when the exact quote appears more
 * than once in the document. Counts matching characters working inward from each end, so a
 * perfect-context match scores `prefix.length + suffix.length` and a completely different
 * surrounding context scores close to 0. */
function contextScore(
  documentText: string,
  start: number,
  end: number,
  quote: TextQuoteSelector,
): number {
  const actualPrefix = documentText.slice(Math.max(0, start - quote.prefix.length), start);
  const actualSuffix = documentText.slice(end, end + quote.suffix.length);

  let score = 0;
  for (let i = 1; i <= Math.min(actualPrefix.length, quote.prefix.length); i++) {
    if (actualPrefix.at(-i) === quote.prefix.at(-i)) score++;
    else break;
  }
  for (let i = 0; i < Math.min(actualSuffix.length, quote.suffix.length); i++) {
    if (actualSuffix[i] === quote.suffix[i]) score++;
    else break;
  }
  return score;
}

/** Collapses every run of whitespace to a single space, returning both the normalized string and
 * a map from each normalized-string index back to its original-string index — reformatting
 * between arXiv HTML pipeline versions (docs/CONTEXT.md section 7.2's "new version appears")
 * typically only changes whitespace/markup around the same words, not the words themselves. */
function normalizeWhitespace(text: string): { normalized: string; toOriginal: number[] } {
  let normalized = "";
  const toOriginal: number[] = [];
  let previousWasSpace = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i] as string;
    if (/\s/.test(char)) {
      if (!previousWasSpace) {
        normalized += " ";
        toOriginal.push(i);
      }
      previousWasSpace = true;
    } else {
      normalized += char;
      toOriginal.push(i);
      previousWasSpace = false;
    }
  }
  return { normalized, toOriginal };
}

/**
 * docs/CONTEXT.md section 7.2 — "When a new version appears, try to re-anchor by fuzzy text-quote
 * match. If that fails, show 'anchored to v1'." Tries, in order: (1) the exact quote, disambiguated
 * by prefix/suffix context when it appears more than once; (2) the same match against a
 * whitespace-normalized copy of the document, for reformatting-only changes. Returns `null` — the
 * "anchored to v1" case — when neither finds a confident match.
 */
export function resolveAnchor(documentText: string, anchor: Anchor): ResolvedAnchor | null {
  const { exact } = anchor.textQuote;

  const exactMatches = allIndicesOf(documentText, exact);
  if (exactMatches.length === 1) {
    const start = exactMatches[0] as number;
    return { start, end: start + exact.length };
  }
  if (exactMatches.length > 1) {
    const best = exactMatches.reduce(
      (bestSoFar, start) => {
        const end = start + exact.length;
        const score = contextScore(documentText, start, end, anchor.textQuote);
        return score > bestSoFar.score ? { start, score } : bestSoFar;
      },
      { start: exactMatches[0] as number, score: -1 },
    );
    return { start: best.start, end: best.start + exact.length };
  }

  // No exact match anywhere — try again against whitespace-normalized text.
  const { normalized: normalizedDoc, toOriginal } = normalizeWhitespace(documentText);
  const { normalized: normalizedExact } = normalizeWhitespace(exact);
  const normalizedMatches = allIndicesOf(normalizedDoc, normalizedExact);
  if (normalizedMatches.length === 0) return null;

  const pick =
    normalizedMatches.length === 1
      ? (normalizedMatches[0] as number)
      : normalizedMatches.reduce((bestIndex, index) => {
          // Reuse the same context-scoring logic on the normalized strings for disambiguation.
          const bestScore = contextScore(
            normalizedDoc,
            bestIndex,
            bestIndex + normalizedExact.length,
            {
              type: "TextQuoteSelector",
              exact: normalizedExact,
              prefix: normalizeWhitespace(anchor.textQuote.prefix).normalized,
              suffix: normalizeWhitespace(anchor.textQuote.suffix).normalized,
            },
          );
          const candidateScore = contextScore(
            normalizedDoc,
            index,
            index + normalizedExact.length,
            {
              type: "TextQuoteSelector",
              exact: normalizedExact,
              prefix: normalizeWhitespace(anchor.textQuote.prefix).normalized,
              suffix: normalizeWhitespace(anchor.textQuote.suffix).normalized,
            },
          );
          return candidateScore > bestScore ? index : bestIndex;
        }, normalizedMatches[0] as number);

  const start = toOriginal[pick];
  const end = toOriginal[pick + normalizedExact.length - 1];
  if (start === undefined || end === undefined) return null;
  return { start, end: end + 1 };
}
