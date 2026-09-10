import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  reactStrictMode: true,
  transpilePackages: ["beez-ui"],
  experimental: {
    // Use Turbopack's native React Compiler in development and production.
    turbopackRustReactCompiler: true,
    // Validate the production project with the native TypeScript 7 compiler.
    useTypeScriptCli: true,
  },
};

export default nextConfig;
