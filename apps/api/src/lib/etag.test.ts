import { describe, expect, it } from "vitest";
import { weakEtagFor } from "./etag.js";

describe("weakEtagFor", () => {
  it("is stable for the same timestamp", () => {
    const date = new Date("2026-01-01T00:00:00Z");
    expect(weakEtagFor(date)).toBe(weakEtagFor(date));
  });

  it("differs for different timestamps", () => {
    expect(weakEtagFor(new Date("2026-01-01T00:00:00Z"))).not.toBe(
      weakEtagFor(new Date("2026-01-02T00:00:00Z")),
    );
  });

  it("is a well-formed weak ETag", () => {
    expect(weakEtagFor(new Date())).toMatch(/^W\/"[0-9a-f]{16}"$/);
  });
});
