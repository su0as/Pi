import { describe, expect, it } from "vitest";
import { brand } from "./brand";

describe("brand", () => {
  it("exposes the fields every client needs", () => {
    expect(brand.name).toBeTruthy();
    expect(brand.shortName).toBeTruthy();
    expect(brand.domain).toBeTruthy();
    expect(brand.supportEmail).toContain("@");
    expect(brand.arxivContactEmail).toContain("@");
  });
});
