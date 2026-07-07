import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  experimental: {
    // Tree-shake large/barrel packages so each route only bundles the exports it
    // actually uses. lucide-react ships hundreds of icon modules and framer-motion
    // is imported across many client components — without this they bloat the
    // shared client chunk.
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
};

export default nextConfig;
