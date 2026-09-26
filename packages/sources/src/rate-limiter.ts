/**
 * docs/CONTEXT.md section 9.4 — arXiv politeness: "at most 1 request per 3 seconds, single
 * connection." A queue, not a token bucket: calls are serialized (never in flight
 * concurrently) and each one waits out whatever's left of the interval since the last one
 * *started*, which is what "single connection" actually requires.
 */
export function createRateLimiter(minIntervalMs: number) {
  let queue: Promise<void> = Promise.resolve();
  let lastRunAt = 0;

  return function schedule<T>(fn: () => Promise<T>): Promise<T> {
    const result = queue.then(async () => {
      const wait = Math.max(0, lastRunAt + minIntervalMs - Date.now());
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      lastRunAt = Date.now();
      return fn();
    });
    queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
}
