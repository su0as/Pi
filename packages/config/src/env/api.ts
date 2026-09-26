import { z } from "zod";
import { brand } from "../brand.js";

/**
 * Env schema for apps/api. Grows as later milestones add object storage, etc. — extend this
 * schema (and .env.example) rather than reading process.env directly anywhere else in apps/api.
 */
const apiEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.url(),
  // Comma-separated list — docs/CONTEXT.md section 12.4: "CORS allowlist from env (web origin,
  // extension origin IDs)".
  CORS_ALLOWED_ORIGINS: z
    .string()
    .default("http://localhost:3000")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  // docs/CONTEXT.md section 12.4: "Rate limits per user and per IP."
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  // docs/CONTEXT.md section 12.4: "Idempotency-Key header ... on all creating POSTs."
  IDEMPOTENCY_KEY_TTL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(24 * 60 * 60 * 1000),

  // --- M3: auth (docs/CONTEXT.md section 12.3 — self-hosted better-auth, no passwords) ---
  BETTER_AUTH_SECRET: z.string().min(16),
  BETTER_AUTH_URL: z.url().default("http://localhost:3001"),
  WEB_URL: z.url().default("http://localhost:3000"),
  // Google/Apple are optional at boot — better-auth only registers a provider when both of its
  // credentials are present, so local dev works without either (email OTP still does). Real
  // credentials are a deploy-time secret, not something this repo can supply.
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  APPLE_CLIENT_ID: z.string().optional(),
  APPLE_CLIENT_SECRET: z.string().optional(),
  APPLE_APP_BUNDLE_IDENTIFIER: z.string().optional(),

  // --- M3: email (docs/CONTEXT.md section 12.3 — Resend + React Email, Mailpit locally) ---
  EMAIL_FROM: z.email().default(`noreply@${brand.domain}`),
  // Only used when RESEND_API_KEY is unset — Mailpit locally, any real SMTP relay otherwise.
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  RESEND_API_KEY: z.string().optional(),

  // --- M4: ingestion (docs/CONTEXT.md section 9.3/9.4) ---
  // arXiv's stated politeness requirement is a contact email in the User-Agent; reused as the
  // `mailto` param for OpenAlex/Crossref's polite pools too, since CONTEXT.md doesn't ask for a
  // separate one per source and this repo has exactly one such contact.
  ARXIV_CONTACT_EMAIL: z.string().default(brand.arxivContactEmail),
  // "resolves ... or fetches+ingests synchronously with a timeout" — how long `GET
  // /v1/works/resolve` waits before returning 202 and letting ingestion finish in the background.
  WORK_RESOLVE_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export function loadApiEnv(source: NodeJS.ProcessEnv = process.env): ApiEnv {
  const result = apiEnvSchema.safeParse(source);
  if (!result.success) {
    console.error("Invalid apps/api environment:", z.treeifyError(result.error));
    throw new Error("apps/api failed to boot: invalid environment variables");
  }
  return result.data;
}
