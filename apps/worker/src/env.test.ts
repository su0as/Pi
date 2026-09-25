import { loadWorkerEnv } from "@repo/config/env/worker";
import { describe, expect, it } from "vitest";

describe("loadWorkerEnv", () => {
  it("accepts a valid environment", () => {
    const env = loadWorkerEnv({ DATABASE_URL: "postgres://user:pass@localhost:5432/test_db" });
    expect(env.NODE_ENV).toBe("development");
  });

  it("rejects a missing DATABASE_URL", () => {
    expect(() => loadWorkerEnv({})).toThrow();
  });
});
