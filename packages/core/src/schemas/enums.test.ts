import { describe, expect, it } from "vitest";
import {
  noteEvidenceKindSchema,
  noteTypeSchema,
  notificationTypeSchema,
  workTypeSchema,
} from "./enums.js";

describe("DB-enum-backed schemas", () => {
  it("accepts a real note type and rejects a made-up one", () => {
    expect(noteTypeSchema.safeParse("correction").success).toBe(true);
    expect(noteTypeSchema.safeParse("hot_take").success).toBe(false);
  });

  it("accepts a real work type and rejects a made-up one", () => {
    expect(workTypeSchema.safeParse("preprint").success).toBe(true);
    expect(workTypeSchema.safeParse("blog_post").success).toBe(false);
  });
});

describe("app-level-only schemas (DB column is text)", () => {
  it("accepts a curated evidence kind and rejects an uncurated one", () => {
    expect(noteEvidenceKindSchema.safeParse("citation").success).toBe(true);
    expect(noteEvidenceKindSchema.safeParse("vibes").success).toBe(false);
  });

  it("accepts a curated notification type and rejects an uncurated one", () => {
    expect(notificationTypeSchema.safeParse("reply_received").success).toBe(true);
    expect(notificationTypeSchema.safeParse("spam").success).toBe(false);
  });
});
