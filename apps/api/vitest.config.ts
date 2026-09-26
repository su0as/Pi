import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // The auth flow tests poll real Mailpit deliveries over HTTP (src/test-mailpit.ts) — slower
    // than the 5s default, especially when the whole suite is hitting Postgres + Mailpit
    // together, not a sign of a hanging test.
    testTimeout: 15_000,
    server: {
      deps: {
        inline: [/^@repo\//],
      },
    },
  },
});
