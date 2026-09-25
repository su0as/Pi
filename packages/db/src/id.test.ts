import { describe, expect, it } from "vitest";
import { generateId } from "./id";

describe("generateId", () => {
  it("produces a valid UUIDv7", () => {
    const value = generateId();
    expect(value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("is time-sortable — later ids sort after earlier ones", async () => {
    const first = generateId();
    // UUIDv7's monotonicity guarantee is per-millisecond-timestamp, not per-call — two calls in
    // the same millisecond can legitimately sort either way on their random suffix. Force a
    // millisecond boundary so this test asserts what's actually guaranteed.
    await new Promise((resolve) => setTimeout(resolve, 2));
    const second = generateId();
    expect(first < second).toBe(true);
  });

  it("never repeats across many calls", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => generateId()));
    expect(ids.size).toBe(1000);
  });
});
