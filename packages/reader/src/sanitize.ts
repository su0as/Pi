import sanitizeHtml from "sanitize-html";

// docs/CONTEXT.md section 10 — "sanitize (strict allowlist; MathML allowed; no scripts, no
// inline event handlers, no external iframes)"; CLAUDE.md rule 8 — "Sanitize all HTML
// server-side before rendering." This is an allowlist, not a blocklist: anything not named here
// (script, style, iframe, object, embed, form, on* attributes, javascript: URLs, ...) is dropped
// by construction, not by enumerating what to reject.

const STRUCTURAL_TAGS = [
  "div",
  "span",
  "p",
  "article",
  "section",
  "header",
  "footer",
  "nav",
  "aside",
  "ul",
  "ol",
  "li",
  "dl",
  "dt",
  "dd",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "td",
  "th",
  "caption",
  "colgroup",
  "col",
  "figure",
  "figcaption",
  "img",
  "a",
  "br",
  "hr",
  "blockquote",
  "pre",
  "code",
  "sup",
  "sub",
  "em",
  "strong",
  "i",
  "b",
  "u",
  "s",
  "small",
  "mark",
  "cite",
  "q",
  "abbr",
  "time",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
];

// MathML — every element tag this repo has actually seen in real arXiv HTML output plus the rest
// of the MathML Core element set (all lowercase per spec, unlike SVG's camelCase names).
const MATHML_TAGS = [
  "math",
  "semantics",
  "annotation",
  "annotation-xml",
  "mrow",
  "mi",
  "mo",
  "mn",
  "mtext",
  "mspace",
  "ms",
  "msup",
  "msub",
  "msubsup",
  "munder",
  "mover",
  "munderover",
  "mfrac",
  "msqrt",
  "mroot",
  "mtable",
  "mtr",
  "mtd",
  "mlabeledtr",
  "mmultiscripts",
  "mprescripts",
  "none",
  "menclose",
  "mpadded",
  "mphantom",
  "mstyle",
  "merror",
  "mglyph",
];

export const ALLOWED_TAGS = [...STRUCTURAL_TAGS, ...MATHML_TAGS];

export const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  "*": ["id", "class", "lang", "dir", "title"],
  a: ["href"],
  img: ["src", "alt", "width", "height", "style"],
  td: ["colspan", "rowspan"],
  th: ["colspan", "rowspan", "scope"],
  time: ["datetime"],
  math: ["display", "alttext"],
  annotation: ["encoding"],
  "annotation-xml": ["encoding"],
  mspace: ["width", "height", "depth"],
  mtable: ["columnalign", "rowalign"],
  mtd: ["columnspan", "rowspan"],
};

export function sanitizeReaderHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    // No <link>/<style> ever reach the allowlist, so remote/inline stylesheets are already gone;
    // this only restricts the handful of inline `style` values LaTeXML emits on <img> (e.g.
    // `aspect-ratio:912/1344;`) to layout-only properties — never `background`/`content`/`url()`.
    allowedStyles: {
      img: {
        "aspect-ratio": [/^[\d./]+$/],
        width: [/^\d+(px|%)?$/],
        height: [/^\d+(px|%)?$/],
      },
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https"] },
    allowProtocolRelative: false,
    // Disallowed tags (script, iframe, object, style, form, ...) are dropped along with their
    // contents entirely, rather than escaped into visible text or having only the tag stripped.
    disallowedTagsMode: "discard",
    nestingLimit: 100,
  });
}
