"use client";

import { useChainId, useReadContract } from "wagmi";
import { getContractAddress } from "@tagit/contracts";

/**
 * TAGITCore.metadataHash(uint256) — the anchored canonical-doc hash written by
 * updateMetadataHash (the services anchor worker). The shared
 * @tagit/contracts TAGITCore ABI predates the anchor rail and lacks this
 * getter, so the single view fragment lives inline here; the read itself goes
 * through the app's one deduped wagmi/viem instance.
 */
const metadataHashAbi = [
  {
    type: "function",
    name: "metadataHash",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
] as const;

export function useMetadataHash(tokenId: bigint | null) {
  const chainId = useChainId();
  const core = getContractAddress(chainId, "TAGITCore");

  const { data, isLoading, error, refetch } = useReadContract({
    address: core,
    abi: metadataHashAbi,
    functionName: "metadataHash",
    args: tokenId !== null ? [tokenId] : undefined,
    query: { enabled: tokenId !== null },
  });

  return {
    /** bytes32 hash (zero hash when never anchored), undefined while loading. */
    metadataHash: data as `0x${string}` | undefined,
    isLoading,
    error,
    refetch,
  };
}
