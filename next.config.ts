import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  typedRoutes: true,
  experimental: {
    // TypeScript 7 has no JS compiler API, so the build type-checks with `tsc`.
    useTypeScriptCli: true,
    // Each icon is its own module. This keeps the dev server from loading
    // all of them for one import.
    optimizePackageImports: ["@nuvui/icons"],
  },
};

export default nextConfig;
