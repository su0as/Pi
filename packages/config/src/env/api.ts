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
