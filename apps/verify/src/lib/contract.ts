import { keccak256 } from "viem";

// Real TAGITCore proxy on Base Sepolia (primary chain)
// Hardcoded — do NOT use NEXT_PUBLIC_TAGIT_CORE_ADDRESS env var,
// it was set to the demo contract on Vercel and caused "Asset Not Found"
export const CONTRACT_ADDRESS = "0x3aDc7EFDb58Ae85483eFf5D4966D916185f31d1D" as `0x${string}`;

/*
 * NO CHAIN TRANSPORT LIVES HERE — deliberately.
 *
 * This module is imported by client components (asset-client.tsx for the buy
 * config, and the tap pages for metadata), so anything defined here can reach
 * the browser. Every chain read therefore lives in ./contract.server.ts, which
 * is fenced with `import "server-only"`: a client component that reaches it
 * fails the build instead of shipping an RPC URL to visitors.
 *
 * What remains below is pure data and pure functions — no network, no secrets.
 * If you find yourself adding a viem client to this file, that is the signal
 * that the code belongs in contract.server.ts instead.
 */

/** Static metadata for known demo tokens (fallback when ?meta= IPFS URL is missing).
 * `meta` field is an ipfs://Qm... URL the page auto-fetches if no ?meta= query param.
 * `priceUsdc` is the "tap to buy" price (USDC, 6-decimal token) shown on the Buy button. */
const ASSET_METADATA: Record<
  string,
  { productName?: string; msrp?: string; meta?: string; priceUsdc?: number }
> = {
  "5": {
    productName: "PDRN Capsule Cream 100",
    msrp: "$22.00",
    priceUsdc: 22,
    meta: "ipfs://QmZLqbsFDKpHc4BsnP4fVcNd4PEi6JriR9MUmJ9bia6oKQ",
  },
  "18": { productName: "TAG IT Sneaker", msrp: "$199.99", priceUsdc: 199.99 },
  "19": { productName: "Nike Air Max 90", msrp: "$149.99", priceUsdc: 149.99 },
  "20": { productName: "DI0R Eye Cream", msrp: "$77.73", priceUsdc: 77.73 },
};

/** Fallback "tap to buy" price for demo tokens minted on the fly (unknown id). */
const DEFAULT_PRICE_USDC = 1;

export function getMetadataForToken(tokenId: string): {
  productName?: string;
  msrp?: string;
  meta?: string;
  priceUsdc?: number;
} {
  return ASSET_METADATA[tokenId] || {};
}

/**
 * Buy config for the "tap to buy" flow. Every token is purchasable (the page
 * only renders the Buy button when state === ACTIVATED); price comes from the
 * token's metadata or a small default so freshly pre-minted demo tokens still
 * show a sensible price.
 */
export function getBuyConfigForToken(tokenId: string): {
  productName?: string;
  priceUsdc: number;
} {
  const meta = ASSET_METADATA[tokenId];
  return {
    productName: meta?.productName,
    priceUsdc: meta?.priceUsdc ?? DEFAULT_PRICE_USDC,
  };
}

/** Convert a raw NFC UID (hex string, no colons) to a tag hash */
export function uidToTagHash(uid: string): `0x${string}` {
  const clean = uid.replace(/[:\-\s]/g, "").toLowerCase();
  const bytes = `0x${clean}` as `0x${string}`;
  return keccak256(bytes);
}
