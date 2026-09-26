import { describe, expect, it } from "vitest";
import { canEditHandle, isValidHandle, nextHandleEditAt, slugifyForHandle } from "./handle";

describe("canEditHandle", () => {
  it("allows editing when the handle has never been changed", () => {
    expect(canEditHandle(null)).toBe(true);
  });

  it("blocks editing within the 30-day cooldown", () => {
    const now = new Date("2026-02-01T00:00:00Z");
    const changedAt = new Date("2026-01-15T00:00:00Z");
    expect(canEditHandle(changedAt, now)).toBe(false);
  });

  it("allows editing once 30 days have passed", () => {
    const changedAt = new Date("2026-01-01T00:00:00Z");
    const now = new Date("2026-01-31T00:00:00Z");
    expect(canEditHandle(changedAt, now)).toBe(true);
  });
});

describe("nextHandleEditAt", () => {
  it("returns null when never changed", () => {
    expect(nextHandleEditAt(null)).toBeNull();
  });

  it("returns 30 days after the last change", () => {
    const changedAt = new Date("2026-01-01T00:00:00Z");
    expect(nextHandleEditAt(changedAt)).toEqual(new Date("2026-01-31T00:00:00Z"));
  });
});

describe("isValidHandle", () => {
  it("accepts lowercase alphanumeric and underscore, 3-20 chars", () => {
    expect(isValidHandle("alice_chen")).toBe(true);
  });

  it("rejects uppercase, spaces, and out-of-range lengths", () => {
    expect(isValidHandle("Alice")).toBe(false);
    expect(isValidHandle("a b")).toBe(false);
    expect(isValidHandle("ab")).toBe(false);
    expect(isValidHandle("a".repeat(21))).toBe(false);
  });
});

describe("slugifyForHandle", () => {
  it("lowercases and replaces non-alphanumerics with underscores", () => {
    expect(slugifyForHandle("Alice Chen")).toBe("alice_chen");
  });

  it("strips diacritics", () => {
    expect(slugifyForHandle("José García")).toBe("jose_garcia");
  });

  it("falls back to a user_ prefix for very short input", () => {
    expect(isValidHandle(slugifyForHandle("Al"))).toBe(true);
  });

  it("always produces a valid handle", () => {
    expect(isValidHandle(slugifyForHandle("!!!"))).toBe(true);
  });
});
