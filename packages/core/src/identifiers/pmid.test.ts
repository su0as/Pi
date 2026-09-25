import { describe, expect, it } from "vitest";
import { parsePmid } from "./pmid.js";

describe("parsePmid", () => {
  it("parses a PMID:-prefixed value", () => {
    expect(parsePmid("PMID: 12345678")).toBe("12345678");
  });

  it("parses a PMID:-prefixed value with no space", () => {
    expect(parsePmid("pmid:12345678")).toBe("12345678");
  });

  it("parses a PubMed URL", () => {
    expect(parsePmid("https://pubmed.ncbi.nlm.nih.gov/12345678/")).toBe("12345678");
  });

  it("parses a PubMed URL without a trailing slash", () => {
    expect(parsePmid("https://pubmed.ncbi.nlm.nih.gov/12345678")).toBe("12345678");
  });

  it("does not treat a bare number as a PMID", () => {
    expect(parsePmid("12345678")).toBeNull();
  });

  it("returns null for an unrelated string", () => {
    expect(parsePmid("not a pmid")).toBeNull();
  });
});
