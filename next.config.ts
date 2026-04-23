import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "export",
  images: {
    unoptimized: true,
  },
  reactCompiler: true,

  experimental: {
    viewTransition: true,
  },

  turbopack: {
    rules: {
      "*.arrow": { type: "asset" },
      "*.parquet": { type: "asset" },
      "*.csv": { type: "asset" },
    },
    resolveAlias: {
      "onnxruntime-node": {
        browser: "./src/shims/empty.ts",
      },
      sharp: {
        browser: "./src/shims/empty.ts",
      },
    },
  },
};

export default nextConfig;
