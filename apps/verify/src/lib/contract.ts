import { createPublicClient, http, keccak256 } from "viem";
import { arbitrumSepolia } from "viem/chains";
import { TAGITCoreABI } from "./abi";

// Default to demo contract — same as admin lifecycle page
export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_TAGIT_CORE_ADDRESS ||
  "0x62A81066Cc868cDe6115b87F1d585c891BFfCcC3") as `0x${string}`;

const RPC_URL =
  process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC ||
  "https://sepolia-rollup.arbitrum.io/rpc";

export const publicClient = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(RPC_URL),
});

/** Parse the on-chain name field which may be JSON with {name, msrp} */
function parseNameField(raw: string): { productName: string; msrp?: string } {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.name === "string") {
      return { productName: parsed.name, msrp: parsed.msrp };
    }
  } catch {}
  return { productName: raw || "" };
}

export async function getAsset(tokenId: bigint) {
  const result = (await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: TAGITCoreABI,
    functionName: "getAsset",
    args: [tokenId],
  })) as { name: string; state: number; owner: string; mintedAt: bigint; lastUpdated: bigint };

  const { productName, msrp } = parseNameField(result.name);

  return {
    owner: result.owner,
    timestamp: result.mintedAt,
    state: result.state,
    productName,
    msrp,
  };
}

/** Convert a raw NFC UID (hex string, no colons) to a tag hash */
export function uidToTagHash(uid: string): `0x${string}` {
  const clean = uid.replace(/[:\-\s]/g, "").toLowerCase();
  const bytes = `0x${clean}` as `0x${string}`;
  return keccak256(bytes);
}
