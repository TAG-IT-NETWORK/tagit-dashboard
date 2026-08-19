/**
 * Guessable aliases for the canonical verdict URL.
 *
 * WHY THESE EXIST. Models hallucinate URLs. Asked where to check TAG IT token 5,
 * a model will guess verify.tagit.network/5 or /verify/5 long before it guesses
 * /asset/5, because those are the shapes every other verification service uses.
 * Today each of those returns a hard 404, which is a dead end for exactly the
 * traffic DEV-ANVS-001 exists to capture, and a 404 is also the one response an
 * answer engine will not retry.
 *
 * NO NEW ROUTE HANDLERS — this is a redirect table, not code. The canonical
 * routes already exist and are already server-rendered, cached and rate-limited;
 * a handler would be a second place for the verdict to be computed, which is the
 * one thing this project forbids.
 *
 * THE BARE /:tokenId RULE IS THE DANGEROUS ONE and is why every pattern below
 * carries an explicit `(\\d{1,78})` constraint. Unconstrained, `/:tokenId` at the
 * root matches EVERY single-segment path on the host — /sun, /mcp, a future
 * /pricing — and silently swallows them. The digit constraint means it can only
 * ever match something that could plausibly be a token id. 78 digits is
 * ceil(log10(2^256)), the same bound the public JSON API applies, and it also
 * stops a megabyte of digits reaching BigInt().
 *
 * PERMANENT (308), NOT TEMPORARY. Next emits 308 for `permanent: true`; search
 * engines treat it as they do 301, and it additionally preserves the method.
 * These are brand-new alias paths with no traffic and no prior behaviour to
 * undo, and the entire point is to consolidate ranking signals onto
 * /asset/{id}. The reversibility argument that made /tag/{uid} a 307 does not
 * apply to a path that has never served anything.
 *
 * Verified by scripts/test-redirects.ts, which asserts both that these fire AND
 * that they do not shadow /asset, /api, /mcp, /sun, /tag or the GS1 resolver.
 */
const TOKEN_ID = "\\d{1,78}";

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
  async redirects() {
    return [
      // The shape a model guesses first: bare id at the root.
      { source: `/:tokenId(${TOKEN_ID})`, destination: "/asset/:tokenId", permanent: true },
      // The shape a human types, and what most competitors use.
      { source: `/verify/:tokenId(${TOKEN_ID})`, destination: "/asset/:tokenId", permanent: true },
      // Short form, common in QR payloads.
      { source: `/t/:tokenId(${TOKEN_ID})`, destination: "/asset/:tokenId", permanent: true },
      // Chip-identity form. Lands on /tag/{uid}, which resolves or explains —
      // NOT on /asset, because a uid is not a token id and pretending otherwise
      // would produce a confident verdict for the wrong asset.
      { source: "/uid/:uid", destination: "/tag/:uid", permanent: true },
    ];
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
