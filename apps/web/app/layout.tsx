import { brand } from "@repo/config/brand";
import { loadWebEnv } from "@repo/config/env/web";
import type { Metadata } from "next";
import { Geist, Source_Serif_4 } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import type { ReactNode } from "react";
import { AnalyticsProvider } from "@/components/analytics-provider";
import { Providers } from "@/components/providers";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { cn } from "@/lib/utils";
import "./globals.css";

// docs/CONTEXT.md section 13 — "self-hosted UI sans + reading serif." next/font/google downloads
// and self-hosts these at build time (no runtime request to Google Fonts), which is what
// "self-hosted" means here — not manually vendored font files.
const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const sourceSerif = Source_Serif_4({ subsets: ["latin"], variable: "--font-serif" });

export const metadata: Metadata = {
  metadataBase: new URL(`https://${brand.domain}`),
  title: { default: brand.name, template: `%s — ${brand.name}` },
  description: "Read papers, see what real readers think.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const messages = await getMessages();
  const env = loadWebEnv();

  return (
    <html lang="en" suppressHydrationWarning className={cn(geist.variable, sourceSerif.variable)}>
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <NextIntlClientProvider messages={messages}>
          <AnalyticsProvider
            posthogKey={env.NEXT_PUBLIC_POSTHOG_KEY}
            posthogHost={env.NEXT_PUBLIC_POSTHOG_HOST}
          >
            <Providers>
              <SiteHeader />
              <div className="flex-1">{children}</div>
              <SiteFooter />
            </Providers>
          </AnalyticsProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
