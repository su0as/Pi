import { z } from "zod";

// An unset env var in a real environment is `undefined`, but `.env` files (and this repo's own
// `.env.example` convention of `KEY=` for "not configured yet") give it an empty string instead —
// which `.optional()` alone doesn't treat as absent. Normalizes both to `undefined` before the
// real schema runs.
function optional<T extends z.ZodType>(schema: T) {
  return z.preprocess((value) => (value === "" ? undefined : value), schema.optional());
}

/**
 * Only NEXT_PUBLIC_* vars belong here if they must reach the browser bundle.
 * Server-only web env (session secrets, etc.) gets its own non-public schema
 * once apps/web needs them (M3+).
 */
const webEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_API_URL: z.url().default("http://localhost:3001"),
  // M6: for the future iOS app's universal links (docs/CONTEXT.md section 5.1) — both optional
  // since no iOS app (and so no real Team ID) exists yet; the route just omits `applinks` details
  // until they're set.
  NEXT_PUBLIC_APPLE_TEAM_ID: optional(z.string()),
  NEXT_PUBLIC_APPLE_APP_BUNDLE_IDENTIFIER: optional(z.string()),
  // M6: error tracking + product analytics (docs/CONTEXT.md section 12.3). Both optional and
  // unset by default — this repo never requires a paid third-party account to run; each only
  // initializes when its own env var is present (see instrumentation.ts / instrumentation-client.ts
  // and components/analytics-provider.tsx).
  NEXT_PUBLIC_SENTRY_DSN: optional(z.url()),
  NEXT_PUBLIC_POSTHOG_KEY: optional(z.string()),
  NEXT_PUBLIC_POSTHOG_HOST: z.url().default("https://us.i.posthog.com"),
});

export type WebEnv = z.infer<typeof webEnvSchema>;

export function loadWebEnv(source: NodeJS.ProcessEnv = process.env): WebEnv {
  const result = webEnvSchema.safeParse(source);
  if (!result.success) {
    console.error("Invalid apps/web environment:", z.treeifyError(result.error));
    throw new Error("apps/web failed to boot: invalid environment variables");
  }
  return result.data;
}
