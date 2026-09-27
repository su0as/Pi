import { describe, expect, it } from "vitest";
import { createAnchor, resolveAnchor } from "./anchor.js";

const DOC =
  "The Transformer model relies entirely on self-attention mechanisms, dispensing with recurrence and convolutions entirely. " +
  "This architecture generalizes well to other sequence transduction tasks beyond translation.";

describe("createAnchor", () => {
  it("captures the exact quote and up to 32 chars of prefix/suffix context", () => {
    const start = DOC.indexOf("self-attention mechanisms");
    const end = start + "self-attention mechanisms".length;
    const anchor = createAnchor(DOC, start, end, "S3");

    expect(anchor.textQuote.exact).toBe("self-attention mechanisms");
    expect(anchor.textQuote.prefix.length).toBeLessThanOrEqual(32);
    expect(anchor.textQuote.suffix.length).toBeLessThanOrEqual(32);
    expect(DOC.endsWith(anchor.textQuote.prefix, start)).toBe(true);
    expect(anchor.textPosition).toEqual({ type: "TextPositionSelector", start, end });
    expect(anchor.fragment).toEqual({ type: "FragmentSelector", value: "S3" });
  });

  it("shrinks prefix/suffix near the document boundaries instead of erroring", () => {
    const anchor = createAnchor(DOC, 0, 3, null);
    expect(anchor.textQuote.prefix).toBe("");
    expect(anchor.fragment).toBeNull();
  });

  it("throws for an invalid range", () => {
    expect(() => createAnchor(DOC, 10, 5)).toThrow();
    expect(() => createAnchor(DOC, -1, 5)).toThrow();
    expect(() => createAnchor(DOC, 0, DOC.length + 10)).toThrow();
  });
});

describe("resolveAnchor", () => {
  it("re-finds a quote that appears exactly once, unchanged", () => {
    const start = DOC.indexOf("dispensing with recurrence");
    const end = start + "dispensing with recurrence".length;
    const anchor = createAnchor(DOC, start, end, null);

    const resolved = resolveAnchor(DOC, anchor);
    expect(resolved).toEqual({ start, end });
  });

  it("disambiguates a repeated quote using prefix/suffix context", () => {
    const doc =
      "Section A: the result was significant. Section B: the result was not significant at all.";
    const start = doc.indexOf("the result was", doc.indexOf("Section B"));
    const end = start + "the result was".length;
    const anchor = createAnchor(doc, start, end, null);

    const resolved = resolveAnchor(doc, anchor);
    expect(resolved).toEqual({ start, end });
  });

  it("re-anchors across a whitespace-only reformatting (new pipeline version)", () => {
    const start = DOC.indexOf("self-attention mechanisms");
    const end = start + "self-attention mechanisms".length;
    const anchor = createAnchor(DOC, start, end, null);

    // Same words, reflowed with different line breaks/spacing — a realistic v1 -> v2 diff for the
    // same underlying LaTeX source re-rendered.
    const reflowed = DOC.replace(
      "self-attention mechanisms",
      "self-attention\n    mechanisms",
    ).replace("entirely on", "entirely  on");
    const resolved = resolveAnchor(reflowed, anchor);
    expect(resolved).not.toBeNull();
    expect(reflowed.slice(resolved?.start, resolved?.end).replace(/\s+/g, " ")).toBe(
      "self-attention mechanisms",
    );
  });

  it("returns null (docs/CONTEXT.md's 'anchored to v1' case) when the quote is genuinely gone", () => {
    const start = DOC.indexOf("self-attention mechanisms");
    const end = start + "self-attention mechanisms".length;
    const anchor = createAnchor(DOC, start, end, null);

    const rewritten =
      "This paper was completely rewritten with an entirely different architecture.";
    expect(resolveAnchor(rewritten, anchor)).toBeNull();
  });

  it("still resolves correctly when the quote sits at the very start or end of the document", () => {
    const startAnchor = createAnchor(DOC, 0, "The Transformer".length, null);
    expect(resolveAnchor(DOC, startAnchor)).toEqual({ start: 0, end: "The Transformer".length });

    const tailStart = DOC.length - "beyond translation.".length;
    const endAnchor = createAnchor(DOC, tailStart, DOC.length, null);
    expect(resolveAnchor(DOC, endAnchor)).toEqual({ start: tailStart, end: DOC.length });
  });
});
