import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limiter";

describe("createRateLimiter", () => {
  it("runs the first call immediately", async () => {
    const schedule = createRateLimiter(50);
    const start = Date.now();
    await schedule(async () => "a");
    expect(Date.now() - start).toBeLessThan(30);
  });

  it("spaces subsequent calls by at least the interval", async () => {
    const schedule = createRateLimiter(50);
    const start = Date.now();
    await schedule(async () => 1);
    await schedule(async () => 2);
    await schedule(async () => 3);
    expect(Date.now() - start).toBeGreaterThanOrEqual(95); // 2 intervals, small tolerance
  });

  it("keeps the queue moving even if a call rejects", async () => {
    const schedule = createRateLimiter(10);
    await expect(
      schedule(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    const result = await schedule(async () => "still works");
    expect(result).toBe("still works");
  });

  it("preserves call order", async () => {
    const schedule = createRateLimiter(5);
    const order: number[] = [];
    await Promise.all([
      schedule(async () => order.push(1)),
      schedule(async () => order.push(2)),
      schedule(async () => order.push(3)),
    ]);
    expect(order).toEqual([1, 2, 3]);
  });
});
