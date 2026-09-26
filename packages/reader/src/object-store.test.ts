import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createS3ObjectStore } from "./object-store.js";

// Real SeaweedFS (docker-compose's `object-storage` service), not mocked — this repo's testing
// philosophy (CLAUDE.md) is integration tests against real infrastructure. Requires
// `docker compose up -d`.
const store = createS3ObjectStore({
  bucket: process.env.OBJECT_STORAGE_BUCKET ?? "pi-dev",
  region: "us-east-1",
  endpoint: process.env.OBJECT_STORAGE_ENDPOINT ?? "http://localhost:8333",
  accessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY_ID ?? "pi_dev_access_key",
  secretAccessKey: process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY ?? "pi_dev_secret_key_change_me",
});

describe("createS3ObjectStore", () => {
  it("round-trips a real put/get against the S3-compatible endpoint", async () => {
    const key = `test/${randomUUID()}.json`;
    await store.put(key, JSON.stringify({ hello: "reader" }), "application/json");

    const body = await store.get(key);
    expect(body).toBe(JSON.stringify({ hello: "reader" }));
  });

  it("returns null for a key that was never written", async () => {
    const body = await store.get(`test/${randomUUID()}-does-not-exist.json`);
    expect(body).toBeNull();
  });
});
