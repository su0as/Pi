import { createApiClient } from "@repo/api-client";
import { loadWebEnv } from "@repo/config/env/web";
import { cookies } from "next/headers";

/**
 * docs/CONTEXT.md section 12.1 — "No client talks to the database directly," only through the
 * HTTP API via packages/api-client. Forwards the browser's session cookie so server components
 * render signed-in state correctly once a route actually needs it (none do yet — M7's notes/
 * ratings UI is the first caller that will pass an authenticated request).
 */
export async function apiClient() {
  const env = loadWebEnv();
  const cookieStore = await cookies();
  return createApiClient(env.NEXT_PUBLIC_API_URL, {
    headers: { cookie: cookieStore.toString() },
  });
}
