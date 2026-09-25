import { loadApiEnv } from "@pi/config/env/api";
import { describe, expect, it } from "vitest";

describe("loadApiEnv", () => {
  it("accepts a valid environment", () => {
    const env = loadApiEnv({ DATABASE_URL: "postgres://pi:pi@localhost:5432/pi_dev" });
    expect(env.PORT).toBe(3001);
    expect(env.NODE_ENV).toBe("development");
  });

  it("rejects a missing DATABASE_URL", () => {
    expect(() => loadApiEnv({})).toThrow();
  });
});
