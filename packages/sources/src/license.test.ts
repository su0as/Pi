import { describe, expect, it } from "vitest";
import { canDisplayFullText } from "./license";

describe("canDisplayFullText", () => {
  it("returns false for null", () => {
    expect(canDisplayFullText(null)).toBe(false);
  });

  // Real license URL seen on a real arXiv paper (1706.03762) while building this connector —
  // not on the allowlist even though the paper is freely readable on arxiv.org.
  it("returns false for arXiv's own default license", () => {
    expect(canDisplayFullText("http://arxiv.org/licenses/nonexclusive-distrib/1.0/")).toBe(false);
  });

  // Real license URL seen on a real, recent arXiv paper (2609.30249) while building this.
  it("returns true for CC-BY", () => {
    expect(canDisplayFullText("http://creativecommons.org/licenses/by/4.0/")).toBe(true);
  });

  it("returns true for CC-BY-SA, CC-BY-NC, CC-BY-NC-SA, and CC0", () => {
    expect(canDisplayFullText("https://creativecommons.org/licenses/by-sa/4.0/")).toBe(true);
    expect(canDisplayFullText("https://creativecommons.org/licenses/by-nc/4.0/")).toBe(true);
    expect(canDisplayFullText("https://creativecommons.org/licenses/by-nc-sa/4.0/")).toBe(true);
    expect(canDisplayFullText("https://creativecommons.org/publicdomain/zero/1.0/")).toBe(true);
  });

  it("does not confuse by-nc/by-sa with plain by", () => {
    // Regression guard for a substring-matching bug: "licenses/by-nc/" must not match a pattern
    // anchored on "licenses/by/".
    expect(canDisplayFullText("https://creativecommons.org/licenses/by-nc/4.0/")).toBe(true);
  });

  it("returns false for an unrelated or restrictive license", () => {
    expect(canDisplayFullText("https://creativecommons.org/licenses/by-nd/4.0/")).toBe(false);
    expect(canDisplayFullText("https://example.com/all-rights-reserved")).toBe(false);
  });
});
