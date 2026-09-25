import createFetchClient, { type ClientOptions } from "openapi-fetch";
import type { paths } from "./schema";

/**
 * Typed client for the `/v1` API — every caller (apps/web's server components, later
 * apps/mobile, apps/extension) goes through this, never `packages/db` directly
 * (docs/CONTEXT.md section 12.1: "No client talks to the database directly.").
 */
export function createApiClient(baseUrl: string, options?: Omit<ClientOptions, "baseUrl">) {
  return createFetchClient<paths>({ baseUrl, ...options });
}

export type ApiClient = ReturnType<typeof createApiClient>;
