"use client";

import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import type { ReactNode } from "react";
import { useEffect } from "react";

/**
 * docs/CONTEXT.md section 12.3 — PostHog product analytics. No-ops entirely (renders `children`
 * with no provider) when `NEXT_PUBLIC_POSTHOG_KEY` is unset — this repo never requires a paid
 * third-party account to run.
 */
export function AnalyticsProvider({
  posthogKey,
  posthogHost,
  children,
}: {
  posthogKey: string | undefined;
  posthogHost: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!posthogKey || posthog.__loaded) return;
    posthog.init(posthogKey, { api_host: posthogHost, capture_pageview: true });
  }, [posthogKey, posthogHost]);

  if (!posthogKey) return <>{children}</>;
  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
