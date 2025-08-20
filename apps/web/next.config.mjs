/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { typedRoutes: true },
  transpilePackages: ["@lexmind/shared"],
};
export default nextConfig;
