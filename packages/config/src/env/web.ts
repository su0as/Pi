import { z } from "zod";

/**
 * Only NEXT_PUBLIC_* vars belong here if they must reach the browser bundle.
 * Server-only web env (session secrets, etc.) gets its own non-public schema
 * once apps/web needs them (M3+).
 */
const webEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_API_URL: z.url().default("http://localhost:3001"),
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
