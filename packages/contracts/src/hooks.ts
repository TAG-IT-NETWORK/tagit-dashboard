import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { CONTRACTS, CHAIN_ID } from "./addresses";
import { TAGITCoreABI } from "./abis/TAGITCore";
import { TAGITAccessABI } from "./abis/TAGITAccess";
import { IdentityBadgeABI } from "./abis/IdentityBadge";
import { CapabilityBadgeABI } from "./abis/CapabilityBadge";

// ============================================================================
// TAGITCore Hooks
// ============================================================================

export function useAsset(assetId: bigint) {
  return useReadContract({
    address: CONTRACTS.TAGITCore as `0x${string}`,
    abi: TAGITCoreABI,
    functionName: "getAsset",
    args: [assetId],
    chainId: CHAIN_ID,
  });
}

export function useAssetState(assetId: bigint) {
  return useReadContract({
    address: CONTRACTS.TAGITCore as `0x${string}`,
    abi: TAGITCoreABI,
    functionName: "getState",
    args: [assetId],
    chainId: CHAIN_ID,
  });
}

export function useAssetOwner(assetId: bigint) {
  return useReadContract({
    address: CONTRACTS.TAGITCore as `0x${string}`,
    abi: TAGITCoreABI,
    functionName: "ownerOf",
    args: [assetId],
    chainId: CHAIN_ID,
  });
}

export function useTotalSupply() {
  return useReadContract({
    address: CONTRACTS.TAGITCore as `0x${string}`,
    abi: TAGITCoreABI,
    functionName: "totalSupply",
    chainId: CHAIN_ID,
  });
}

export function useContractName() {
  return useReadContract({
    address: CONTRACTS.TAGITCore as `0x${string}`,
    abi: TAGITCoreABI,
    functionName: "name",
    chainId: CHAIN_ID,
  });
}

export function useContractSymbol() {
  return useReadContract({
    address: CONTRACTS.TAGITCore as `0x${string}`,
    abi: TAGITCoreABI,
    functionName: "symbol",
    chainId: CHAIN_ID,
  });
}

export function useMint() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const mint = (to: `0x${string}`, metadataURI: string) => {
    writeContract({
      address: CONTRACTS.TAGITCore as `0x${string}`,
      abi: TAGITCoreABI,
      functionName: "mint",
      args: [to, metadataURI],
      chainId: CHAIN_ID,
    });
  };

  return { mint, hash, isPending, isConfirming, isSuccess, error };
}

export function useBindTag() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const bindTag = (assetId: bigint, tagId: `0x${string}`) => {
    writeContract({
      address: CONTRACTS.TAGITCore as `0x${string}`,
      abi: TAGITCoreABI,
      functionName: "bindTag",
      args: [assetId, tagId],
      chainId: CHAIN_ID,
    });
  };

  return { bindTag, hash, isPending, isConfirming, isSuccess, error };
}

export function useActivate() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const activate = (assetId: bigint) => {
    writeContract({
      address: CONTRACTS.TAGITCore as `0x${string}`,
      abi: TAGITCoreABI,
      functionName: "activate",
      args: [assetId],
      chainId: CHAIN_ID,
    });
  };

  return { activate, hash, isPending, isConfirming, isSuccess, error };
}

export function useClaim() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const claim = (assetId: bigint) => {
    writeContract({
      address: CONTRACTS.TAGITCore as `0x${string}`,
      abi: TAGITCoreABI,
      functionName: "claim",
      args: [assetId],
      chainId: CHAIN_ID,
    });
  };

  return { claim, hash, isPending, isConfirming, isSuccess, error };
}

export function useFlag() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const flag = (assetId: bigint, reason: string) => {
    writeContract({
      address: CONTRACTS.TAGITCore as `0x${string}`,
      abi: TAGITCoreABI,
      functionName: "flag",
      args: [assetId, reason],
      chainId: CHAIN_ID,
    });
  };

  return { flag, hash, isPending, isConfirming, isSuccess, error };
}

export function useResolve() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const resolve = (assetId: bigint) => {
    writeContract({
      address: CONTRACTS.TAGITCore as `0x${string}`,
      abi: TAGITCoreABI,
      functionName: "resolve",
      args: [assetId],
      chainId: CHAIN_ID,
    });
  };

  return { resolve, hash, isPending, isConfirming, isSuccess, error };
}

export function useRecycle() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const recycle = (assetId: bigint) => {
    writeContract({
      address: CONTRACTS.TAGITCore as `0x${string}`,
      abi: TAGITCoreABI,
      functionName: "recycle",
      args: [assetId],
      chainId: CHAIN_ID,
    });
  };

  return { recycle, hash, isPending, isConfirming, isSuccess, error };
}

// ============================================================================
// TAGITAccess Hooks
// ============================================================================

export function useHasCapability(address: `0x${string}` | undefined, capability: number) {
  return useReadContract({
    address: CONTRACTS.TAGITAccess as `0x${string}`,
    abi: TAGITAccessABI,
    functionName: "hasCapability",
    args: address ? [address, BigInt(capability)] : undefined,
    chainId: CHAIN_ID,
    query: {
      enabled: !!address,
    },
  });
}

export function useCapabilities(address: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACTS.TAGITAccess as `0x${string}`,
    abi: TAGITAccessABI,
    functionName: "getCapabilities",
    args: address ? [address] : undefined,
    chainId: CHAIN_ID,
    query: {
      enabled: !!address,
    },
  });
}

// ============================================================================
// IdentityBadge Hooks
// ============================================================================

export function useIdentityBadgeType(address: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACTS.IdentityBadge as `0x${string}`,
    abi: IdentityBadgeABI,
    functionName: "getBadgeType",
    args: address ? [address] : undefined,
    chainId: CHAIN_ID,
    query: {
      enabled: !!address,
    },
  });
}

export function useHasBadge(address: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACTS.IdentityBadge as `0x${string}`,
    abi: IdentityBadgeABI,
    functionName: "hasBadge",
    args: address ? [address] : undefined,
    chainId: CHAIN_ID,
    query: {
      enabled: !!address,
    },
  });
}

// ============================================================================
// CapabilityBadge Hooks
// ============================================================================

export function useCapabilityBadgeBalance(
  address: `0x${string}` | undefined,
  capabilityId: number
) {
  return useReadContract({
    address: CONTRACTS.CapabilityBadge as `0x${string}`,
    abi: CapabilityBadgeABI,
    functionName: "balanceOf",
    args: address ? [address, BigInt(capabilityId)] : undefined,
    chainId: CHAIN_ID,
    query: {
      enabled: !!address,
    },
  });
}
