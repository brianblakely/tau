import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,

  turbopack: {
    rules: {
      "*.arrow": { type: "asset" },
      "*.parquet": { type: "asset" },
      "*.csv": { type: "asset" },
    },
  },
};

export default nextConfig;
