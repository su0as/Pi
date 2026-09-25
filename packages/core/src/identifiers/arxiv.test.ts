import { describe, expect, it } from "vitest";
import { parseArxivId } from "./arxiv.js";

describe("parseArxivId", () => {
  it("parses a bare new-format id", () => {
    expect(parseArxivId("1706.03762")).toEqual({ normalized: "1706.03762", version: null });
  });

  it("parses a new-format id with a version suffix", () => {
    expect(parseArxivId("1706.03762v5")).toEqual({ normalized: "1706.03762", version: 5 });
  });

  it("parses an arXiv:-prefixed id", () => {
    expect(parseArxivId("arXiv:1810.04805")).toEqual({ normalized: "1810.04805", version: null });
  });

  it("parses an /abs/ URL", () => {
    expect(parseArxivId("https://arxiv.org/abs/2005.14165")).toEqual({
      normalized: "2005.14165",
      version: null,
    });
  });

  it("parses an /abs/ URL with a version", () => {
    expect(parseArxivId("https://arxiv.org/abs/2005.14165v4")).toEqual({
      normalized: "2005.14165",
      version: 4,
    });
  });

  it("parses a /pdf/ URL with a .pdf suffix", () => {
    expect(parseArxivId("https://arxiv.org/pdf/1706.03762v5.pdf")).toEqual({
      normalized: "1706.03762",
      version: 5,
    });
  });

  it("parses an /html/ URL", () => {
    expect(parseArxivId("https://arxiv.org/html/1706.03762")).toEqual({
      normalized: "1706.03762",
      version: null,
    });
  });

  it("parses an old-format id with a subject class", () => {
    expect(parseArxivId("math.GT/0309136")).toEqual({
      normalized: "math.gt/0309136",
      version: null,
    });
  });

  it("parses an old-format id without a subject class, with a version", () => {
    expect(parseArxivId("hep-th/9901001v2")).toEqual({
      normalized: "hep-th/9901001",
      version: 2,
    });
  });

  it("returns null for a DOI", () => {
    expect(parseArxivId("10.1038/nphys1170")).toBeNull();
  });

  it("returns null for an unrelated string", () => {
    expect(parseArxivId("attention is all you need")).toBeNull();
  });
});
