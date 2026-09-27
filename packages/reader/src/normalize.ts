import { parseHTML } from "linkedom";
import { sanitizeReaderHtml } from "./sanitize.js";
import type { ReaderDocument, ReaderFigure, ReaderOutlineEntry, ReaderReference } from "./types.js";

/** LaTeXML's real, current output nests `<section id="S1" class="ltx_section">`,
 * `ltx_subsection`, `ltx_subsubsection`, ... — verified directly against a live fetch of arXiv's
 * HTML rendering. Rather than special-case each class name, the section `id`'s own dot-nesting
 * (`S1` → 1, `S3.SS1` → 2) already encodes depth, since LaTeXML assigns ids that way. */
function outlineLevel(sectionId: string): number {
  return sectionId.split(".").length;
}

function resolveUrl(value: string, baseUrl: string): string {
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return value;
  }
}

/** LaTeXML renders some figures (SVG diagrams, seen in a real fetch — e.g.
 * `<object type="image/svg+xml" data="anaphora_resolution_new.svg">`) as `<object>` rather than
 * `<img>`. `<object>` is a real XSS vector (arbitrary embedded content/plugins) and is correctly
 * never in the sanitizer's allowlist — but the image itself is legitimate paper content, not
 * something to silently drop. Converts each into an equivalent `<img>` before sanitizing, rather
 * than either allowing `<object>` through or losing the figure. */
function convertObjectImagesToImg(root: Element, document: Document): void {
  for (const object of Array.from(root.querySelectorAll('object[type^="image/"][data]'))) {
    const data = object.getAttribute("data");
    if (!data) continue;
    const img = document.createElement("img");
    img.setAttribute("src", data);
    for (const attr of ["id", "class", "style", "width", "height"]) {
      const value = object.getAttribute(attr);
      if (value) img.setAttribute(attr, value);
    }
    object.replaceWith(img);
  }
}

/** Every `<img>` needs an `alt` for accessibility (verified via a real Lighthouse run against a
 * live paper page — LaTeXML doesn't always emit one). Figures already carry their meaning via
 * their `<figcaption>` (surfaced separately in `figures`), so a blank/decorative default is
 * correct here rather than fabricating alt text — never guess a caption that isn't there. */
function ensureImageAltText(root: Element): void {
  for (const img of Array.from(root.querySelectorAll("img:not([alt])"))) {
    img.setAttribute("alt", "");
  }
}

/** LaTeXML repeats the paper's title as an `<h1 class="ltx_title_document">` inside the article
 * body — the caller (apps/web's paper page) already renders the title once as its own `<h1>`
 * from the work's own metadata, so this becomes a duplicate `<h1>` plus a heading-order violation
 * (verified via a real Lighthouse run) rather than useful content. Removed, not just demoted. */
function removeDuplicateDocumentTitle(root: Element): void {
  root.querySelector("h1.ltx_title_document")?.remove();
}

function rewriteRelativeUrls(root: Element, baseUrl: string): void {
  for (const img of Array.from(root.querySelectorAll("img[src]"))) {
    const src = img.getAttribute("src");
    if (src) img.setAttribute("src", resolveUrl(src, baseUrl));
  }
  for (const a of Array.from(root.querySelectorAll("a[href]"))) {
    const href = a.getAttribute("href");
    // Only rewrite same-document/relative links — fragment-only links (footnote/citation
    // back-references, e.g. "#S1") should keep working within the reader's own rendered page.
    if (href && !href.startsWith("#")) a.setAttribute("href", resolveUrl(href, baseUrl));
  }
}

function extractOutline(root: Element): ReaderOutlineEntry[] {
  const entries: ReaderOutlineEntry[] = [];
  const sections = root.querySelectorAll(
    "section.ltx_section, section.ltx_subsection, section.ltx_subsubsection",
  );
  for (const section of Array.from(sections)) {
    const id = section.getAttribute("id");
    const heading = section.querySelector("h1, h2, h3, h4, h5, h6");
    if (!id || !heading) continue;
    entries.push({ id, level: outlineLevel(id), title: heading.textContent.trim() });
  }
  return entries;
}

function extractFigures(root: Element, baseUrl: string): ReaderFigure[] {
  const figures: ReaderFigure[] = [];
  for (const [index, figure] of Array.from(root.querySelectorAll("figure")).entries()) {
    const img = figure.querySelector("img");
    if (!img) continue; // a figure without an image (e.g. an algorithm listing) isn't a "figure" here
    const src = img.getAttribute("src");
    if (!src) continue;
    const caption = figure.querySelector("figcaption");
    figures.push({
      id: figure.getAttribute("id") ?? `figure-${index + 1}`,
      src: resolveUrl(src, baseUrl),
      caption: caption ? caption.textContent.trim() : null,
    });
  }
  return figures;
}

function extractReferences(root: Element): ReaderReference[] {
  const references: ReaderReference[] = [];
  for (const [index, item] of Array.from(root.querySelectorAll("li.ltx_bibitem")).entries()) {
    const text = item.textContent.replace(/\s+/g, " ").trim();
    if (!text) continue;
    references.push({ id: item.getAttribute("id") ?? `ref-${index + 1}`, text, workId: null });
  }
  return references;
}

/**
 * docs/CONTEXT.md section 10 — "normalize to the PI Reader Document." `html` is the raw arXiv
 * HTML page; `baseUrl` is the exact URL it was fetched from (e.g.
 * `https://arxiv.org/html/1706.03762`, no redirect, no trailing slash, no version suffix —
 * verified directly against a live fetch), needed to resolve the relative asset paths LaTeXML
 * emits. Those paths already embed the version segment themselves (e.g.
 * `1706.03762v7/Figures/ModalNet-21.png`), so passing a version- or slash-adjusted `baseUrl`
 * silently double-prefixes every resolved URL instead of erroring — pass the fetched URL as-is.
 */
export function normalizeArxivHtml(html: string, baseUrl: string): ReaderDocument {
  const { document } = parseHTML(html);
  // LaTeXML wraps the actual paper content in <article class="ltx_document"> — everything
  // outside it (arXiv's site chrome: nav, the "Report GitHub Issue" modal, theme-toggle scripts)
  // is page furniture we don't want in the reader document at all, not content to sanitize.
  const article = document.querySelector("article.ltx_document") ?? document.body;
  if (!article) {
    throw new Error("normalizeArxivHtml: no <article> or <body> found in the source HTML");
  }

  convertObjectImagesToImg(article, document);
  removeDuplicateDocumentTitle(article);
  rewriteRelativeUrls(article, baseUrl);
  ensureImageAltText(article);
  const outline = extractOutline(article);
  const figures = extractFigures(article, baseUrl);
  const references = extractReferences(article);
  const bodyHtml = sanitizeReaderHtml(article.innerHTML);

  return { bodyHtml, outline, figures, references };
}
