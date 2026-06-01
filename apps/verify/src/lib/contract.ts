import { createPublicClient, http, keccak256 } from "viem";
import { baseSepolia } from "viem/chains";
import { TAGITCoreABI } from "./abi";

// Real TAGITCore proxy on Base Sepolia (primary chain)
// Hardcoded — do NOT use NEXT_PUBLIC_TAGIT_CORE_ADDRESS env var,
// it was set to the demo contract on Vercel and caused "Asset Not Found"
export const CONTRACT_ADDRESS = "0x3aDc7EFDb58Ae85483eFf5D4966D916185f31d1D" as `0x${string}`;

const RPC_URL = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC || "https://sepolia.base.org";

export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(RPC_URL),
});

/** Static metadata for known demo tokens (fallback when ?meta= IPFS URL is missing).
 * `meta` field is an ipfs://Qm... URL the page auto-fetches if no ?meta= query param. */
const ASSET_METADATA: Record<string, { productName?: string; msrp?: string; meta?: string }> = {
  "5": {
    productName: "PDRN Capsule Cream 100",
    msrp: "$22.00",
    meta: "ipfs://QmZLqbsFDKpHc4BsnP4fVcNd4PEi6JriR9MUmJ9bia6oKQ",
  },
  "18": { productName: "TAG IT Sneaker", msrp: "$199.99" },
  "19": { productName: "Nike Air Max 90", msrp: "$149.99" },
  "20": { productName: "DI0R Eye Cream", msrp: "$77.73" },
};

export function getMetadataForToken(tokenId: string): {
  productName?: string;
  msrp?: string;
  meta?: string;
} {
  return ASSET_METADATA[tokenId] || {};
}

export async function getAsset(tokenId: bigint) {
  const [owner, timestamp, state, flags, reserved] = (await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: TAGITCoreABI,
    functionName: "getAsset",
    args: [tokenId],
  })) as [string, bigint, number, number, number];

  return { owner, timestamp, state, flags, reserved };
}

export async function getTokenByTag(tagHash: `0x${string}`) {
  return publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: TAGITCoreABI,
    functionName: "getTokenByTag",
    args: [tagHash],
  });
}

export async function getTagByToken(tokenId: bigint) {
  return publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: TAGITCoreABI,
    functionName: "getTagByToken",
    args: [tokenId],
  });
}

/**
 * Read the on-chain metadata content hash — keccak256 of the off-chain DPP
 * metadata JSON. This is the integrity anchor: if the off-chain passport bytes
 * change, their keccak256 no longer matches this value, so tampering is
 * detectable. Returns null (not a throw) for the zero hash / unset.
 */
export async function getMetadataHash(tokenId: bigint): Promise<`0x${string}` | null> {
  const hash = (await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: TAGITCoreABI,
    functionName: "metadataHash",
    args: [tokenId],
  })) as `0x${string}`;
  if (!hash || /^0x0{64}$/.test(hash)) return null;
  return hash;
}

/** Convert a raw NFC UID (hex string, no colons) to a tag hash */
export function uidToTagHash(uid: string): `0x${string}` {
  const clean = uid.replace(/[:\-\s]/g, "").toLowerCase();
  const bytes = `0x${clean}` as `0x${string}`;
  return keccak256(bytes);
}
