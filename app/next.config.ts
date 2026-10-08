import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // the sable packages run as native Node code (node:sqlite, background
  // worker) — keep them out of the webpack bundle
  serverExternalPackages: ["@sable/core", "@sable/sdk", "@sable/agents"],
  webpack(config) {
    // allow NodeNext-style "./x.js" imports to resolve to ./x.ts sources
    config.resolve.extensionAlias = {
      ".js": [".js", ".ts", ".tsx"],
      ".mjs": [".mjs", ".mts"],
    };
    return config;
  },
};

export default nextConfig;
