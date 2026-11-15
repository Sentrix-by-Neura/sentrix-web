import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
    agentUpgrade: "security",
  },
  cacheComponents: true,
  partialPrefetching: true,
  webpack(config) {
    // Keep the existing Tailwind loader available for Webpack production builds.
    for (const rule of config.module.rules) {
      for (const entry of rule.oneOf ?? []) {
        if (Array.isArray(entry.use) && entry.use.some((item: { loader?: string }) => item.loader?.includes("postcss-loader"))) {
          entry.use.push({ loader: "@tailwindcss/turbopack" });
        }
      }
    }
    return config;
  },
  turbopack: {
    rules: {
      "globals.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
