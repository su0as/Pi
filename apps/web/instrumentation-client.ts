import * as Sentry from "@sentry/nextjs";

// See instrumentation.ts for why there's no `withSentryConfig` build wrapper.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
  });
}
