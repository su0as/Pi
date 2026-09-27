import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { normalizeArxivHtml } from "./normalize.js";

const FIXTURE_HTML = readFileSync(
  fileURLToPath(new URL("./fixtures/arxiv-html-1706.03762.html", import.meta.url)),
  "utf8",
);
// The actual arXiv HTML page URL (verified via a live fetch — no redirect, no trailing slash,
// no version suffix) — relative asset paths like "1706.03762v7/Figures/x.png" only resolve
// correctly against this exact form, not a version-suffixed or trailing-slashed variant.
const BASE_URL = "https://arxiv.org/html/1706.03762";

describe("normalizeArxivHtml", () => {
  const doc = normalizeArxivHtml(FIXTURE_HTML, BASE_URL);

  it("produces a sanitized body containing the paper's actual content, not arXiv's site chrome", () => {
    expect(doc.bodyHtml).toContain("Introduction");
    expect(doc.bodyHtml).not.toContain("Report GitHub Issue");
    expect(doc.bodyHtml).not.toContain("<script");
  });

  it("removes the paper's own duplicate <h1> title (the caller renders it once, from work metadata)", () => {
    expect(doc.bodyHtml).not.toContain("ltx_title_document");
    expect(doc.bodyHtml).not.toMatch(/<h1[^>]*>Attention Is All You Need/);
  });

  it("gives every <img> an alt attribute, even when the source didn't provide one", () => {
    const imgTags = doc.bodyHtml.match(/<img\b[^>]*>/g) ?? [];
    expect(imgTags.length).toBeGreaterThan(0);
    for (const tag of imgTags) {
      expect(tag).toMatch(/\salt="/);
    }
  });

  it("preserves MathML in the sanitized body", () => {
    expect(doc.bodyHtml).toContain("<math");
    expect(doc.bodyHtml).toContain("<annotation");
  });

  it("builds an outline from real section ids, with nesting depth from the id itself", () => {
    expect(doc.outline.length).toBeGreaterThan(10);
    const introduction = doc.outline.find((e) => e.id === "S1");
    expect(introduction).toMatchObject({ id: "S1", level: 1 });
    expect(introduction?.title).toContain("Introduction");

    const subsection = doc.outline.find((e) => e.id === "S3.SS1");
    expect(subsection?.level).toBe(2);
  });

  it("extracts image-bearing figures (including SVG <object> ones), but not data tables", () => {
    // The fixture has 9 <figure class="ltx_figure"> elements total: 2 with a direct <img>, 3 with
    // an <object type="image/svg+xml"> (converted to <img> — see convertObjectImagesToImg), and 4
    // that are actually data tables (LaTeXML wraps numbered tables in <figure> too) with no image
    // at all — those 4 are real content but not "figures" in this interface's sense.
    expect(doc.figures.length).toBe(5);
    const first = doc.figures.find((f) => f.id === "S3.F1");
    expect(first).toBeTruthy();
    expect(first?.src).toBe("https://arxiv.org/html/1706.03762v7/Figures/ModalNet-21.png");
    expect(first?.caption).toContain("The Transformer");

    const svgFigure = doc.figures.find((f) => f.id === "Sx1.F3");
    expect(svgFigure?.src).toBe(
      "https://arxiv.org/html/1706.03762v7/making_more_difficult5_new.svg",
    );
  });

  it("extracts the bibliography as plain-text references with workId left unresolved", () => {
    expect(doc.references.length).toBe(40);
    expect(doc.references[0]?.workId).toBeNull();
    expect(doc.references[0]?.text).toContain("Layer normalization");
  });

  it("rewrites relative image src attributes inside the body HTML itself, not just the figures array", () => {
    expect(doc.bodyHtml).toContain("https://arxiv.org/html/1706.03762v7/Figures/ModalNet-21.png");
    expect(doc.bodyHtml).not.toMatch(/src="1706\.03762v7\//);
  });

  it("keeps in-page fragment links (citation/footnote back-references) untouched", () => {
    expect(doc.bodyHtml).toMatch(/href="#S1"|href="#bib\.bib1"/);
  });

  it("falls back to <body> content when there's no LaTeXML <article> wrapper", () => {
    const fallback = normalizeArxivHtml(
      "<html><body><h1>Title</h1><p>Body text.</p></body></html>",
      BASE_URL,
    );
    expect(fallback.bodyHtml).toContain("Body text.");
  });
});
