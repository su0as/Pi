import { loadApiEnv } from "@repo/config/env/api";
import { describe, expect, it } from "vitest";

describe("loadApiEnv", () => {
  it("accepts a valid environment", () => {
    const env = loadApiEnv({ DATABASE_URL: "postgres://user:pass@localhost:5432/test_db" });
    expect(env.PORT).toBe(3001);
    expect(env.NODE_ENV).toBe("development");
  });

  it("rejects a missing DATABASE_URL", () => {
    expect(() => loadApiEnv({})).toThrow();
  });
});
