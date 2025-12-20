/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@tagit/ui", "@tagit/contracts", "@tagit/config"],
};

export default nextConfig;
