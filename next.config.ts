import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // better-sqlite3 is a native module: load it with Node's require, don't bundle it
  serverExternalPackages: ["better-sqlite3"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
    // The app reads its data files (data/*.sqlite, data/words.json) at runtime from the
    // project folder; that is intended for this local app.
    ignoreIssue: [{ path: /src[\\/]lib[\\/]server/, title: /Dynamic filesystem access/ }],
  },
};

export default nextConfig;
