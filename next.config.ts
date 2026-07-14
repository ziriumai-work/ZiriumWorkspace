import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root: a stray lockfile in the home directory otherwise
  // makes Turbopack infer the wrong root. __dirname is this project folder.
  turbopack: {
    root: __dirname,
  },
  // Next 16 replaced the per-indicator flags with a single boolean.
  devIndicators: false,
};

export default nextConfig;
