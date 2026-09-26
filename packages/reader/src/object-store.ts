import { GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { ObjectStore } from "./types.js";

export interface S3ObjectStoreConfig {
  bucket: string;
  region: string;
  /** S3-compatible endpoint — SeaweedFS locally, Cloudflare R2 in production (ADR-0004). */
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** SeaweedFS (and most non-AWS S3-compatible stores) need path-style addressing
   * (`endpoint/bucket/key`) rather than AWS's virtual-hosted style (`bucket.endpoint/key`). */
  forcePathStyle?: boolean;
}

/**
 * docs/CONTEXT.md section 10 — reader documents are "stored in object storage by storage_key."
 * Targets the S3 API directly (ADR-0004): SeaweedFS locally, Cloudflare R2 in production —
 * neither needs a different client, just different endpoint/credentials.
 */
export function createS3ObjectStore(config: S3ObjectStoreConfig): ObjectStore {
  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle ?? true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return {
    async put(key: string, body: string, contentType: string): Promise<void> {
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
    },

    async get(key: string): Promise<string | null> {
      try {
        const res = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
        if (!res.Body) return null;
        return await res.Body.transformToString("utf-8");
      } catch (err) {
        if (err instanceof NoSuchKey) return null;
        throw err;
      }
    },
  };
}
