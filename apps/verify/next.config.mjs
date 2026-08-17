/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Hero images render through the CUSTOM loader in src/lib/media.ts, which
    // maps widths onto the pre-baked CDN variants — Vercel's optimizer is
    // never invoked for them. This allowlist is defense-in-depth so no other
    // next/image usage can ever route a foreign host through the optimizer.
    remotePatterns: [
      { protocol: "https", hostname: "media.tagit.network" },
    ],
  },
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
