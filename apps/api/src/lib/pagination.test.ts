import { describe, expect, it } from "vitest";
import { buildCursorPage, decodeCursor, encodeCursor } from "./pagination.js";

describe("encodeCursor / decodeCursor", () => {
  it("round-trips an id", () => {
    const id = "0198f000-0000-7000-8000-000000000042";
    expect(decodeCursor(encodeCursor(id))).toBe(id);
  });
});

describe("buildCursorPage", () => {
  const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("returns no nextCursor when there's no lookahead row", () => {
    const page = buildCursorPage(rows, 3);
    expect(page.data).toEqual(rows);
    expect(page.nextCursor).toBeNull();
  });

  it("trims the lookahead row and sets nextCursor from the last real row", () => {
    const page = buildCursorPage(rows, 2);
    expect(page.data).toEqual([{ id: "a" }, { id: "b" }]);
    expect(page.nextCursor).toBe(encodeCursor("b"));
  });

  it("returns an empty page with no nextCursor for no rows", () => {
    const page = buildCursorPage([], 20);
    expect(page.data).toEqual([]);
    expect(page.nextCursor).toBeNull();
  });
});
