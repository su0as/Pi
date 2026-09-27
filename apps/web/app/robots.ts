import { brand } from "@repo/config/brand";
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = `https://${brand.domain}`;
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/settings"] },
    sitemap: `${base}/sitemap.xml`,
  };
}
