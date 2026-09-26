import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    server: {
      deps: {
        inline: [/^@repo\//],
      },
    },
    // arxiv.ts's rate limiter is a single module-level queue (mirrors the real single-connection
    // 1-req/3s politeness constraint), so its 3s spacing is cumulative across every arXiv
    // connector call made anywhere in this test file, not just within one test's own calls.
    testTimeout: 20_000,
  },
});
