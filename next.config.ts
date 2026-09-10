import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["beez-ui"],
  experimental: {
    // Validate the production project with the native TypeScript 7 compiler.
    useTypeScriptCli: true,
  },
};

export default nextConfig;
