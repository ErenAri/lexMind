import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  experimental: { typedRoutes: true },
  transpilePackages: ["@lexmind/shared"],
};
export default nextConfig;
