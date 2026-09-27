import { getRequestConfig } from "next-intl/server";
import en from "../messages/en.json";

/**
 * docs/CONTEXT.md section 12.3 — "next-intl scaffolding (English-only messages, but every string
 * routed through it)." Single, fixed locale: no `[locale]` route segment, no locale-detection
 * middleware — those land whenever a second locale actually exists (CONTEXT.md doesn't scope
 * multi-locale to P1).
 */
export default getRequestConfig(async () => ({
  locale: "en",
  messages: en,
}));
