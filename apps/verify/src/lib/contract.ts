import { createPublicClient, http } from "viem";
import { arbitrumSepolia } from "viem/chains";
import { TAGITCoreDemoABI } from "./abi";

const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_TAGIT_CORE_ADDRESS ||
  "0x62A81066Cc868cDe6115b87F1d585c891BFfCcC3") as `0x${string}`;

const RPC_URL =
  process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC ||
  "https://sepolia-rollup.arbitrum.io/rpc";

export const publicClient = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(RPC_URL),
});

export async function getAsset(tokenId: bigint) {
  return publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: TAGITCoreDemoABI,
    functionName: "getAsset",
    args: [tokenId],
  });
}

export async function getTotalAssets() {
  return publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: TAGITCoreDemoABI,
    functionName: "totalAssets",
  });
}

export async function getTokenIds() {
  return publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: TAGITCoreDemoABI,
    functionName: "getTokenIds",
  });
}

export { CONTRACT_ADDRESS };
