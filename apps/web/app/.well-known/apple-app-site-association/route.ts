import { loadWebEnv } from "@repo/config/env/web";
import { NextResponse } from "next/server";

/**
 * docs/CONTEXT.md section 5.1 — served with env-configurable Team ID/bundle ID for the future
 * iOS app's universal links (apps/mobile is a placeholder, P2 — this just reserves the route and
 * shape now). No file extension and no trailing slash is intentional: this is Apple's required
 * exact path.
 */
export async function GET() {
  const env = loadWebEnv();

  if (!env.NEXT_PUBLIC_APPLE_TEAM_ID || !env.NEXT_PUBLIC_APPLE_APP_BUNDLE_IDENTIFIER) {
    return NextResponse.json({ applinks: { details: [] } });
  }

  const appId = `${env.NEXT_PUBLIC_APPLE_TEAM_ID}.${env.NEXT_PUBLIC_APPLE_APP_BUNDLE_IDENTIFIER}`;
  return NextResponse.json({
    applinks: {
      details: [{ appIDs: [appId], components: [{ "/": "/paper/*", comment: "Paper pages" }] }],
    },
  });
}
