"use client";

import { useChainId, useReadContract } from "wagmi";
import { getContractAddress } from "@tagit/contracts";

/** TAGITCore.getTagByToken's inverse: tag hash → token id (0 = not bound). */
const tokenByTagAbi = [
  {
    type: "function",
    name: "getTokenByTag",
    stateMutability: "view",
    inputs: [{ name: "tagHash", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export function useTokenByTag(tagHash: `0x${string}` | null) {
  const chainId = useChainId();
  const core = getContractAddress(chainId, "TAGITCore");
  const { data, isLoading, error, refetch } = useReadContract({
    address: core,
    abi: tokenByTagAbi,
    functionName: "getTokenByTag",
    args: tagHash !== null ? [tagHash] : undefined,
    query: { enabled: tagHash !== null },
  });
  return {
    /** bigint token id (0n when no token is bound to this tag), undefined while loading. */
    tokenId: data as bigint | undefined,
    isLoading,
    error,
    refetch,
  };
}
