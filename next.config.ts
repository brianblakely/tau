import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

export default function nextConfig(phase: string): NextConfig {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER;
  const basePath = isDev ? "" : "/tau";

  return {
    /* config options here */
    output: "export",
    images: {
      unoptimized: true,
    },

    basePath,

    env: {
      NEXT_PUBLIC_BASE_PATH: basePath,
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
}
