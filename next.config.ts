import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Pin the workspace root to THIS directory. Sibling projects share
  // `C:/Users/kazda/kiro/`, which carries its own `package-lock.json`, so Next's
  // multi-lockfile inference can silently select the PARENT as the root. When it
  // does, `serverExternalPackages` below stops matching and Turbopack tries to
  // bundle better-sqlite3 for the browser — failing with `Can't resolve 'fs'`
  // from `better-sqlite3/lib/database.js`. That surfaces as a Playwright
  // `webServer` timeout with a bare "module-not-found" link and no named module,
  // which is very hard to read back to its cause. Pinning removes the inference.
  turbopack: { root: __dirname },
  outputFileTracingRoot: __dirname,
  serverExternalPackages: ['better-sqlite3'],
  experimental: {
    // Tree-shake large/barrel packages so each route only bundles the exports it
    // actually uses. lucide-react ships hundreds of icon modules and framer-motion
    // is imported across many client components — without this they bloat the
    // shared client chunk.
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
};

// DevInspector — dev-only source-location stamping (press `;` then `i`, then
// right-click a component to copy its `src/.../File.tsx:LINE`). Opt-in: the
// Turbopack loader is only registered when launched via `npm run dev:inspect`
// (which sets DEV_INSPECT=1), so a normal `npm run dev` and every production
// build are completely unaffected. See scripts/dev-inspector/.
if (process.env.DEV_INSPECT === "1") {
  const loader = path.join(process.cwd(), "scripts", "dev-inspector", "source-loc-loader.cjs");
  nextConfig.turbopack = {
    ...nextConfig.turbopack,
    rules: {
      ...nextConfig.turbopack?.rules,
      "*.tsx": { loaders: [{ loader, options: { rootDir: process.cwd() } }] },
      "*.jsx": { loaders: [{ loader, options: { rootDir: process.cwd() } }] },
    },
  };
}

export default nextConfig;
