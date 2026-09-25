import { describe, expect, it } from "vitest";
import { parseExternalId } from "./parse-external-id";

describe("parseExternalId", () => {
  it("detects an arXiv id", () => {
    expect(parseExternalId("1706.03762")).toEqual({
      scheme: "arxiv",
      valueNormalized: "1706.03762",
      valueRaw: "1706.03762",
    });
  });

  it("detects an arXiv URL, keeping the version in valueRaw but not valueNormalized", () => {
    expect(parseExternalId("https://arxiv.org/abs/1706.03762v5")).toEqual({
      scheme: "arxiv",
      valueNormalized: "1706.03762",
      valueRaw: "https://arxiv.org/abs/1706.03762v5",
    });
  });

  it("detects a DOI", () => {
    expect(parseExternalId("10.1038/nphys1170")).toEqual({
      scheme: "doi",
      valueNormalized: "10.1038/nphys1170",
      valueRaw: "10.1038/nphys1170",
    });
  });

  it("detects a DOI URL", () => {
    expect(parseExternalId("https://doi.org/10.1038/NPhys1170")).toEqual({
      scheme: "doi",
      valueNormalized: "10.1038/nphys1170",
      valueRaw: "https://doi.org/10.1038/NPhys1170",
    });
  });

  it("detects a PMID", () => {
    expect(parseExternalId("PMID: 12345678")).toEqual({
      scheme: "pmid",
      valueNormalized: "12345678",
      valueRaw: "PMID: 12345678",
    });
  });

  it("returns null for a plain search query", () => {
    expect(parseExternalId("attention is all you need")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parseExternalId("   ")).toBeNull();
  });
});
