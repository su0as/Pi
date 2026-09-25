/**
 * The ONLY file in this repo allowed to hardcode the working brand name.
 * "PI" is a TEMPORARY placeholder (see docs/CONTEXT.md's header note) — when a real
 * name/domain is picked, this is the single file that changes. Every other file,
 * package, table, bundle ID, or URL must import from here instead of writing the
 * literal string.
 */
export interface Brand {
  /** Full product name shown in UI chrome, page titles, emails. */
  name: string;
  /** Compact form for tight spaces (nav bar, favicon alt text). */
  shortName: string;
  /** Primary web domain (no protocol, no trailing slash). */
  domain: string;
  /** Address shown in transactional emails and legal pages. */
  supportEmail: string;
  /** arXiv API / OAI-PMH politeness contact, per docs/CONTEXT.md section 9.4. */
  arxivContactEmail: string;
}

export const brand: Brand = {
  name: "PI",
  shortName: "PI",
  domain: "pi.example",
  supportEmail: "support@pi.example",
  arxivContactEmail: "arxiv-contact@pi.example",
};
