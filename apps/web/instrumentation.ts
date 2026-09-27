/**
 * docs/CONTEXT.md section 12.3 — Sentry error tracking. Next.js's built-in server instrumentation
 * hook; the client-side counterpart is instrumentation-client.ts. Deliberately no
 * `withSentryConfig` build wrapper here — that also uploads source maps to Sentry's API, which
 * needs an org/project auth token this repo can't supply (no Sentry account exists); a plain
 * `Sentry.init()` still reports errors correctly, just without source-mapped stack traces until
 * someone wires that token in.
 */
export async function register() {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;

  const Sentry = await import("@sentry/nextjs");
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
  });
}
