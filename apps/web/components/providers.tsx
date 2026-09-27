"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { useState } from "react";

/**
 * docs/CONTEXT.md section 12.3/13 — "TanStack Query for client mutations" + "light/dark from day
 * one." One `QueryClient` per browser tab (not per render) via `useState`'s lazy initializer —
 * the standard App Router pattern, since a module-level singleton would leak state across
 * requests on the server.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ThemeProvider>
  );
}
