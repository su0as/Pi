import { describe, expect, it } from "vitest";
import { parseDoi } from "./doi.js";

describe("parseDoi", () => {
  it("parses a bare DOI", () => {
    expect(parseDoi("10.1038/nphys1170")).toBe("10.1038/nphys1170");
  });

  it("lowercases a mixed-case DOI", () => {
    expect(parseDoi("10.1038/NPhys1170")).toBe("10.1038/nphys1170");
  });

  it("parses a doi:-prefixed value", () => {
    expect(parseDoi("doi:10.1038/nphys1170")).toBe("10.1038/nphys1170");
  });

  it("parses a doi.org URL", () => {
    expect(parseDoi("https://doi.org/10.1038/nphys1170")).toBe("10.1038/nphys1170");
  });

  it("parses a dx.doi.org URL", () => {
    expect(parseDoi("http://dx.doi.org/10.1038/nphys1170")).toBe("10.1038/nphys1170");
  });

  it("decodes a percent-encoded DOI suffix", () => {
    expect(
      parseDoi("https://doi.org/10.1002/1097-0258(20000915)19:17%3C2263::AID-SIM531%3E3.0.CO;2-M"),
    ).toBe("10.1002/1097-0258(20000915)19:17<2263::aid-sim531>3.0.co;2-m");
  });

  it("returns null for an arXiv id", () => {
    expect(parseDoi("1706.03762")).toBeNull();
  });

  it("returns null for an unrelated string", () => {
    expect(parseDoi("not a doi")).toBeNull();
  });
});
