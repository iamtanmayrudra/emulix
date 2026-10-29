import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A second dev server can run beside the first, with its own build folder and its own in-memory data.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  // Playwright and Lighthouse drive a browser binary and must not be bundled into server code.
  serverExternalPackages: ["playwright", "lighthouse", "playwright-webkit-15", "playwright-webkit-16", "playwright-webkit-17", "playwright-webkit-18"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
