import { createPublicClient, http, keccak256, toHex } from "viem";
import { arbitrumSepolia } from "viem/chains";
import { TAGITCoreABI } from "./abi";

export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_TAGIT_CORE_ADDRESS ||
  "0x2cb1E0ecE274217F214057c0a829582834Aeaf7f") as `0x${string}`;

const RPC_URL =
  process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC ||
  "https://sepolia-rollup.arbitrum.io/rpc";

export const publicClient = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(RPC_URL),
});

export async function getAsset(tokenId: bigint) {
  const [owner, timestamp, state, flags, reserved] =
    (await publicClient.readContract({
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

/** Convert a raw NFC UID (hex string, no colons) to a tag hash */
export function uidToTagHash(uid: string): `0x${string}` {
  const clean = uid.replace(/[:\-\s]/g, "").toLowerCase();
  const bytes = `0x${clean}` as `0x${string}`;
  return keccak256(bytes);
}
