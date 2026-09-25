import { describe, expect, it } from "vitest";
import { AppError, problemDetails, titleForStatus } from "./problem-details.js";

describe("problemDetails", () => {
  it("builds the RFC 9457 shape with a type URI derived from the code", () => {
    const result = problemDetails(404, "not_found", "Not Found", "no such thing", "req-1");
    expect(result.status).toBe(404);
    expect(result.code).toBe("not_found");
    expect(result.requestId).toBe("req-1");
    expect(result.type).toContain("/errors/not_found");
  });

  it("merges extension members", () => {
    const result = problemDetails(400, "validation_error", "Bad Request", undefined, "req-2", {
      issues: [{ path: ["n"] }],
    });
    expect(result.issues).toEqual([{ path: ["n"] }]);
  });
});

describe("titleForStatus", () => {
  it("returns a known title for a mapped status", () => {
    expect(titleForStatus(404)).toBe("Not Found");
  });

  it("falls back to a generic title for an unmapped status", () => {
    expect(titleForStatus(418)).toBe("Error");
  });
});

describe("AppError", () => {
  it("carries status and code", () => {
    const err = new AppError(409, "conflict", "already exists");
    expect(err.status).toBe(409);
    expect(err.code).toBe("conflict");
    expect(err.message).toBe("already exists");
  });
});
