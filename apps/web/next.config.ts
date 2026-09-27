import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  transpilePackages: ["@repo/config", "@repo/core", "@repo/design-tokens", "@repo/api-client"],
};

export default withNextIntl(nextConfig);
