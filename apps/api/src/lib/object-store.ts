import type { ApiEnv } from "@repo/config/env/api";
import { createS3ObjectStore, type ObjectStore } from "@repo/reader";

export function buildObjectStore(env: ApiEnv): ObjectStore {
  return createS3ObjectStore({
    bucket: env.OBJECT_STORAGE_BUCKET,
    region: env.OBJECT_STORAGE_REGION,
    endpoint: env.OBJECT_STORAGE_ENDPOINT,
    accessKeyId: env.OBJECT_STORAGE_ACCESS_KEY_ID,
    secretAccessKey: env.OBJECT_STORAGE_SECRET_ACCESS_KEY,
  });
}
