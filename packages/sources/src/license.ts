/**
 * docs/CONTEXT.md section 9.4: "`can_display_full_text` is derived from an allowlist (CC-BY,
 * CC-BY-SA, CC0, CC-BY-NC* for non-commercial display, public domain). Everything else shows
 * metadata + notes + a link out." Notably: arXiv's own default license
 * ("arxiv.org/licenses/nonexclusive-distrib/1.0/", seen on a real fetch while building this —
 * not every arXiv paper is CC-licensed even though arXiv is fully open for reading there) is
 * NOT on this list, and must not display full text here even though the paper is freely
 * readable on arxiv.org itself.
 */
const ALLOWED_LICENSE_PATTERNS = [
  /^https?:\/\/creativecommons\.org\/licenses\/by\//i,
  /^https?:\/\/creativecommons\.org\/licenses\/by-sa\//i,
  /^https?:\/\/creativecommons\.org\/licenses\/by-nc\//i,
  /^https?:\/\/creativecommons\.org\/licenses\/by-nc-sa\//i,
  /^https?:\/\/creativecommons\.org\/publicdomain\/zero\//i,
  /^https?:\/\/creativecommons\.org\/publicdomain\/mark\//i,
];

export function canDisplayFullText(licenseUrl: string | null): boolean {
  if (!licenseUrl) return false;
  return ALLOWED_LICENSE_PATTERNS.some((pattern) => pattern.test(licenseUrl));
}
