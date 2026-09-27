import { loadWebEnv } from "@repo/config/env/web";
import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

const env = loadWebEnv();

const TOKEN_KEY = "auth_bearer_token";

/**
 * apps/api mounts better-auth at `/v1/auth/*` (apps/api/src/app.ts) with the `bearer` plugin
 * enabled — apps/web and apps/api are different origins, and a cross-site session cookie from
 * apps/api isn't reliably readable by apps/web's own pages (verified directly: neither a cookie
 * nor an auto-persisted token showed up after a real sign-in without this wiring). better-auth's
 * bearer plugin only *returns* the token via a `set-auth-token` response header — persisting it
 * and reattaching it as `Authorization: Bearer <token>` is left to the client, done here with
 * `fetchOptions.onSuccess`/`auth`.
 */
export const authClient = createAuthClient({
  baseURL: `${env.NEXT_PUBLIC_API_URL}/v1/auth`,
  plugins: [emailOTPClient()],
  fetchOptions: {
    auth: {
      type: "Bearer",
      token: () =>
        typeof window === "undefined" ? undefined : (localStorage.getItem(TOKEN_KEY) ?? undefined),
    },
    onSuccess: (ctx) => {
      const token = ctx.response.headers.get("set-auth-token");
      if (token && typeof window !== "undefined") localStorage.setItem(TOKEN_KEY, token);
    },
  },
});
