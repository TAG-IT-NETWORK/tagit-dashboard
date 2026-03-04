import { createRequire } from "module";
import path from "path";
const require = createRequire(import.meta.url);

// Resolve package directories (not entry files) to preserve subpath exports
function pkgDir(pkg) {
  return path.dirname(require.resolve(`${pkg}/package.json`));
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@tagit/ui", "@tagit/contracts", "@tagit/auth", "@tagit/config"],
  webpack: (config) => {
    // Force all workspace packages to share the same wagmi instance.
    // pnpm can create duplicate instances when peer dependency sets differ,
    // which breaks React context (WagmiProvider not found by useConfig).
    const wagmiDir = pkgDir("wagmi");
    const wagmiCoreDir = pkgDir("@wagmi/core");
    config.resolve.alias = {
      ...config.resolve.alias,
      wagmi: wagmiDir,
      "@wagmi/core": wagmiCoreDir,
    };
    return config;
  },
};

export default nextConfig;
