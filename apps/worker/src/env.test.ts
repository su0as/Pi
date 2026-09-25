import { loadWorkerEnv } from "@pi/config/env/worker";
import { describe, expect, it } from "vitest";

describe("loadWorkerEnv", () => {
  it("accepts a valid environment", () => {
    const env = loadWorkerEnv({ DATABASE_URL: "postgres://pi:pi@localhost:5432/pi_dev" });
    expect(env.NODE_ENV).toBe("development");
  });

  it("rejects a missing DATABASE_URL", () => {
    expect(() => loadWorkerEnv({})).toThrow();
  });
});
