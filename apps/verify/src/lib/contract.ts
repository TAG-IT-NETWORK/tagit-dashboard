import { keccak256 } from "viem";

// Real TAGITCore proxy on Base Sepolia (primary chain)
// Hardcoded — do NOT use NEXT_PUBLIC_TAGIT_CORE_ADDRESS env var,
// it was set to the demo contract on Vercel and caused "Asset Not Found"
export const CONTRACT_ADDRESS = "0x3aDc7EFDb58Ae85483eFf5D4966D916185f31d1D" as `0x${string}`;

/*
 * NO CHAIN TRANSPORT LIVES HERE — deliberately.
 *
 * This module is imported by client components (the tap pages for metadata),
 * so anything defined here can reach the browser. Every chain read therefore
 * lives in ./contract.server.ts, which is fenced with `import "server-only"`:
 * a client component that reaches it fails the build instead of shipping an
 * RPC URL to visitors.
 *
 * What remains below is pure data and pure functions — no network, no secrets.
 * If you find yourself adding a viem client to this file, that is the signal
 * that the code belongs in contract.server.ts instead.
 *
 * META-T17: the old ASSET_METADATA demo map and DEFAULT_PRICE_USDC fallback
 * are GONE. Product metadata comes from the tagit-services assets API
 * (@/lib/services → loadProduct in @/lib/dpp) and prices come ONLY from the
 * pricing API (GET /api/v1/assets/:tokenId/price). Do not reintroduce a
 * hardcoded product or price here.
 */

/** Convert a raw NFC UID (hex string, no colons) to a tag hash */
export function uidToTagHash(uid: string): `0x${string}` {
  const clean = uid.replace(/[:\-\s]/g, "").toLowerCase();
  const bytes = `0x${clean}` as `0x${string}`;
  return keccak256(bytes);
}
