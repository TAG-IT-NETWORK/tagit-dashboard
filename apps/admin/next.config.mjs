/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@tagit/ui", "@tagit/contracts", "@tagit/auth", "@tagit/config"],
};

export default nextConfig;
