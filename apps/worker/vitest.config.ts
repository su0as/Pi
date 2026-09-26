import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    server: {
      deps: {
        inline: [/^@repo\//],
      },
    },
    // @repo/sources' arxiv connector rate-limits at 1 req/3s via a single module-level queue
    // (mirrors the real single-connection politeness constraint), so its spacing is cumulative
    // across every arXiv connector call made anywhere in this test file, not just one test's own.
    testTimeout: 20_000,
  },
});
