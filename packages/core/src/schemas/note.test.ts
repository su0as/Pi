import { describe, expect, it } from "vitest";
import { createNoteInputSchema } from "./note";

const base = {
  workId: "0198f000-0000-7000-8000-000000000000",
  workVersionId: null,
  body: "The reported speedup doesn't hold on the released checkpoint.",
  anchor: null,
  language: null,
};

describe("createNoteInputSchema", () => {
  it("rejects a correction with no evidence", () => {
    const result = createNoteInputSchema.safeParse({
      ...base,
      type: "correction",
      evidence: [],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a correction with at least one evidence item", () => {
    const result = createNoteInputSchema.safeParse({
      ...base,
      type: "correction",
      evidence: [{ kind: "citation", url: "https://example.com/errata", label: "Errata" }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a helpful_resource note with no evidence", () => {
    const result = createNoteInputSchema.safeParse({
      ...base,
      type: "helpful_resource",
      evidence: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an evidence item with a kind outside the curated enum", () => {
    const result = createNoteInputSchema.safeParse({
      ...base,
      type: "correction",
      evidence: [{ kind: "vibes", url: "https://example.com", label: "Trust me" }],
    });
    expect(result.success).toBe(false);
  });
});
