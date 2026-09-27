import { createApiClient } from "@repo/api-client";
import { loadWebEnv } from "@repo/config/env/web";

const env = loadWebEnv();

/**
 * Client-component counterpart to lib/api.ts's server-only `apiClient()` — reads the same bearer
 * token lib/auth-client.ts stores in `localStorage` (there's no server-readable session cookie to
 * forward here; see that file's doc comment on why). Creates a fresh client per call rather than
 * a module-level singleton so a sign-in/out in another tab is picked up immediately, not cached.
 */
export function browserApiClient() {
  const token = typeof window === "undefined" ? null : localStorage.getItem("auth_bearer_token");
  return createApiClient(env.NEXT_PUBLIC_API_URL, {
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
  });
}
