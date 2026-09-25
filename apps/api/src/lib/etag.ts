import { createHash } from "node:crypto";
import type { Context } from "hono";

/**
 * ETag support — CLAUDE.md: "ETag / If-None-Match on work and reader endpoints." No route needs
 * this yet (those land M7/M8), but the helper is ready: a weak ETag derived from a resource's own
 * `updatedAt` is cheap (no need to hash the full response body) and changes exactly when the row
 * does.
 */
export function weakEtagFor(updatedAt: Date | string): string {
  const iso = typeof updatedAt === "string" ? updatedAt : updatedAt.toISOString();
  const hash = createHash("sha1").update(iso).digest("hex").slice(0, 16);
  return `W/"${hash}"`;
}

/** Returns a 304 Response if the request's If-None-Match matches, else null (caller proceeds to
 * build the real response and should set the ETag header on it). */
export function conditionalNotModified(c: Context, etag: string): Response | null {
  const ifNoneMatch = c.req.header("if-none-match");
  if (ifNoneMatch && ifNoneMatch === etag) {
    return c.body(null, 304, { ETag: etag });
  }
  return null;
}
