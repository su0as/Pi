import { z } from "zod";

/**
 * Shared by apps/api and apps/worker (both read/write reader documents — the API serves them,
 * the worker builds them) — docs/CONTEXT.md section 10 + ADR-0004 (SeaweedFS locally,
 * Cloudflare R2 in production; same S3 API either way, only endpoint/credentials differ).
 * `pi_dev_*` defaults match `scripts/seaweedfs-s3.json` and are dev-only placeholders, the same
 * pattern as `BETTER_AUTH_SECRET`'s dev default — not secrets worth protecting.
 */
export const objectStorageEnvShape = {
  OBJECT_STORAGE_BUCKET: z.string().default("pi-dev"),
  OBJECT_STORAGE_REGION: z.string().default("us-east-1"),
  OBJECT_STORAGE_ENDPOINT: z.url().default("http://localhost:8333"),
  OBJECT_STORAGE_ACCESS_KEY_ID: z.string().default("pi_dev_access_key"),
  OBJECT_STORAGE_SECRET_ACCESS_KEY: z.string().default("pi_dev_secret_key_change_me"),
};
