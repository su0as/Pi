import { z } from "zod";

/**
 * Env schema for apps/api. Grows as later milestones add auth, object storage,
 * email, etc. — extend this schema (and .env.example) rather than reading
 * process.env directly anywhere else in apps/api.
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
