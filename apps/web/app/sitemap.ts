import { brand } from "@repo/config/brand";
import type { MetadataRoute } from "next";

/**
 * docs/CONTEXT.md section 5.1's "sitemap index" implies per-work entries too, which needs a
 * "list works" endpoint apps/api doesn't have yet (that's M8's search/browse surface) — this
 * covers the static routes for now and gains a `/paper/*` sitemap once that endpoint exists.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = `https://${brand.domain}`;
  const staticPaths = ["/", "/search", "/library", "/rate"];

  return staticPaths.map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
  }));
}
