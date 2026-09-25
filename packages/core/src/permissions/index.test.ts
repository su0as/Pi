import { describe, expect, it } from "vitest";
import { canRateNote, canReplyAsAuthor, canWriteNote, isAdmin, isModerator } from "./index.js";

describe("isModerator / isAdmin", () => {
  it("treats admin as a moderator", () => {
    expect(isModerator("admin")).toBe(true);
    expect(isModerator("moderator")).toBe(true);
    expect(isModerator("user")).toBe(false);
  });

  it("only treats admin as admin", () => {
    expect(isAdmin("admin")).toBe(true);
    expect(isAdmin("moderator")).toBe(false);
  });
});

describe("canWriteNote", () => {
  it("allows anyone during bootstrap mode", () => {
    expect(canWriteNote({ ratingsCompleted: 0, requiredRatings: 5, bootstrapMode: true })).toBe(
      true,
    );
  });

  it("requires the threshold outside bootstrap mode", () => {
    expect(canWriteNote({ ratingsCompleted: 4, requiredRatings: 5, bootstrapMode: false })).toBe(
      false,
    );
    expect(canWriteNote({ ratingsCompleted: 5, requiredRatings: 5, bootstrapMode: false })).toBe(
      true,
    );
  });
});

describe("canRateNote", () => {
  it("blocks the note's own author", () => {
    expect(canRateNote({ raterUserId: "u1", noteAuthorUserId: "u1", raterIsCoAuthor: false })).toBe(
      false,
    );
  });

  it("blocks a co-author", () => {
    expect(canRateNote({ raterUserId: "u1", noteAuthorUserId: "u2", raterIsCoAuthor: true })).toBe(
      false,
    );
  });

  it("allows an unrelated rater", () => {
    expect(canRateNote({ raterUserId: "u1", noteAuthorUserId: "u2", raterIsCoAuthor: false })).toBe(
      true,
    );
  });
});

describe("canReplyAsAuthor", () => {
  it("requires an approved claim", () => {
    expect(canReplyAsAuthor(false)).toBe(false);
    expect(canReplyAsAuthor(true)).toBe(true);
  });
});
