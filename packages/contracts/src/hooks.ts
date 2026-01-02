import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { CONTRACTS, CHAIN_ID } from "./addresses";
import {
  TAGITCoreABI,
  AssetState,
  AssetStateNames,
  type Asset,
  type AssetStateType,
  type ResolutionType,
} from "./abis/TAGITCore";
import { TAGITAccessABI, Capabilities, type CapabilityHash } from "./abis/TAGITAccess";
import { IdentityBadgeABI, BadgeIds, BadgeIdNames, type BadgeId } from "./abis/IdentityBadge";
import { CapabilityBadgeABI } from "./abis/CapabilityBadge";

// ============================================================================
// TAGITCore Read Hooks
// ============================================================================

/**
 * Fetches asset data by token ID
 * @param tokenId - The asset token ID
 * @returns Asset data with loading and error states
 */
export function useAsset(tokenId: bigint) {
  const result = useReadContract({
    address: CONTRACTS.TAGITCore as `0x${string}`,
    abi: TAGITCoreABI,
    functionName: "getAsset",
    args: [tokenId],
    chainId: CHAIN_ID,
  });

  // The ABI returns a tuple that wagmi types as an object with named properties
  const data = result.data as
    | {
        id: bigint;
        owner: `0x${string}`;
        state: number;
        tagId: `0x${string}`;
        metadataURI: string;
        createdAt: bigint;
        updatedAt: bigint;
      }
    | undefined;

  const asset: Asset | undefined = data
    ? {
        id: data.id,
        owner: data.owner,
        state: data.state as AssetStateType,
        tagId: data.tagId,
        metadataURI: data.metadataURI,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      }
    : undefined;

  return {
    asset,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
  };
}

/**
 * Fetches asset state by token ID with human-readable state name
 * @param tokenId - The asset token ID
 * @returns State value and name with loading and error states
 */
export function useAssetState(tokenId: bigint) {
  const result = useReadContract({
    address: CONTRACTS.TAGITCore as `0x${string}`,
    abi: TAGITCoreABI,
    functionName: "getState",
    args: [tokenId],
    chainId: CHAIN_ID,
  });

  const state = result.data as AssetStateType | undefined;
  const stateName = state !== undefined ? AssetStateNames[state] : undefined;

  return {
    state,
    stateName,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
  };
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

// ============================================================================
// TAGITCore Write Hooks
// ============================================================================

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

/**
 * Resolves a flagged asset with a resolution type
 * Resolution: 0=CLEAR, 1=QUARANTINE, 2=DECOMMISSION
 */
export function useResolve() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const resolve = (assetId: bigint, resolution: ResolutionType) => {
    writeContract({
      address: CONTRACTS.TAGITCore as `0x${string}`,
      abi: TAGITCoreABI,
      functionName: "resolve",
      args: [assetId, resolution],
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

/**
 * Checks if an address has a specific capability
 * @param address - The address to check
 * @param capability - The capability hash (use Capabilities.MINTER, etc.)
 */
export function useCapabilityGate(
  address: `0x${string}` | undefined,
  capability: CapabilityHash
) {
  const result = useReadContract({
    address: CONTRACTS.TAGITAccess as `0x${string}`,
    abi: TAGITAccessABI,
    functionName: "hasCapability",
    args: address ? [address, capability] : undefined,
    chainId: CHAIN_ID,
    query: {
      enabled: !!address,
    },
  });

  return {
    hasCapability: result.data === true,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
  };
}

/**
 * Gets all capabilities for an address
 * @param address - The address to check
 */
export function useCapabilities(address: `0x${string}` | undefined) {
  const result = useReadContract({
    address: CONTRACTS.TAGITAccess as `0x${string}`,
    abi: TAGITAccessABI,
    functionName: "getCapabilities",
    args: address ? [address] : undefined,
    chainId: CHAIN_ID,
    query: {
      enabled: !!address,
    },
  });

  return {
    capabilities: (result.data as `0x${string}`[]) ?? [],
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
  };
}

export function useGrantCapability() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const grantCapability = (user: `0x${string}`, capability: CapabilityHash) => {
    writeContract({
      address: CONTRACTS.TAGITAccess as `0x${string}`,
      abi: TAGITAccessABI,
      functionName: "grantCapability",
      args: [user, capability],
      chainId: CHAIN_ID,
    });
  };

  return { grantCapability, hash, isPending, isConfirming, isSuccess, error };
}

export function useRevokeCapability() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const revokeCapability = (user: `0x${string}`, capability: CapabilityHash) => {
    writeContract({
      address: CONTRACTS.TAGITAccess as `0x${string}`,
      abi: TAGITAccessABI,
      functionName: "revokeCapability",
      args: [user, capability],
      chainId: CHAIN_ID,
    });
  };

  return { revokeCapability, hash, isPending, isConfirming, isSuccess, error };
}

// ============================================================================
// IdentityBadge Hooks
// ============================================================================

/**
 * Checks if an address has a specific badge
 * @param address - The address to check
 * @param badgeId - The badge ID to check (use BadgeIds.KYC_L1, etc.)
 * @returns hasBadge boolean with loading state
 */
export function useBadgeCheck(address: `0x${string}` | undefined, badgeId: number) {
  const result = useReadContract({
    address: CONTRACTS.IdentityBadge as `0x${string}`,
    abi: IdentityBadgeABI,
    functionName: "balanceOf",
    args: address ? [address, BigInt(badgeId)] : undefined,
    chainId: CHAIN_ID,
    query: {
      enabled: !!address,
    },
  });

  const balance = result.data as bigint | undefined;

  return {
    hasBadge: balance !== undefined && balance > 0n,
    balance,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
  };
}

/**
 * Gets all badges for an address
 * @param address - The address to check
 */
export function useBadges(address: `0x${string}` | undefined) {
  const result = useReadContract({
    address: CONTRACTS.IdentityBadge as `0x${string}`,
    abi: IdentityBadgeABI,
    functionName: "getBadges",
    args: address ? [address] : undefined,
    chainId: CHAIN_ID,
    query: {
      enabled: !!address,
    },
  });

  const badgeIds = (result.data as bigint[] | undefined)?.map((id) => Number(id) as BadgeId) ?? [];
  const badges = badgeIds.map((id) => ({
    id,
    name: BadgeIdNames[id] ?? `Badge #${id}`,
  }));

  return {
    badges,
    badgeIds,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
  };
}

export function useGrantBadge() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const grantBadge = (to: `0x${string}`, badgeId: number) => {
    writeContract({
      address: CONTRACTS.IdentityBadge as `0x${string}`,
      abi: IdentityBadgeABI,
      functionName: "grant",
      args: [to, BigInt(badgeId)],
      chainId: CHAIN_ID,
    });
  };

  return { grantBadge, hash, isPending, isConfirming, isSuccess, error };
}

export function useRevokeBadge() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const revokeBadge = (from: `0x${string}`, badgeId: number) => {
    writeContract({
      address: CONTRACTS.IdentityBadge as `0x${string}`,
      abi: IdentityBadgeABI,
      functionName: "revoke",
      args: [from, BigInt(badgeId)],
      chainId: CHAIN_ID,
    });
  };

  return { revokeBadge, hash, isPending, isConfirming, isSuccess, error };
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

// Re-export types and constants for convenience
export { AssetState, AssetStateNames, Capabilities, BadgeIds, BadgeIdNames };
export type { Asset, AssetStateType, ResolutionType, CapabilityHash, BadgeId };
