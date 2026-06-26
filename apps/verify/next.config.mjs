/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // Privy v3 lazy-imports optional integrations we don't use (Stripe fiat
    // onramp, Farcaster mini-app Solana). They're never reached for the
    // email + embedded-wallet flow, but webpack still tries to resolve them
    // at build time. Stub them to empty modules so the build doesn't require
    // deps we'll never call.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@stripe/crypto": false,
      "@farcaster/mini-app-solana": false,
    };
    return config;
  },
};

export default nextConfig;
