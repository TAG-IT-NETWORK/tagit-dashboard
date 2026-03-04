import { useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt, useWalletClient, useChainId } from "wagmi";
import { useMemo } from "react";
import { keccak256, toBytes, encodePacked, toHex, parseGwei } from "viem";
import { getContractsForChain } from "./addresses";

// Arbitrum Sepolia chain ID
const ARBITRUM_SEPOLIA_ID = 421614;

/**
 * Returns gas fee overrides for Arbitrum Sepolia to prevent
 * "maxFeePerGas < baseFee" errors from tight MetaMask estimation.
 * On Arbitrum Sepolia, baseFee is ~0.02 gwei so 0.5 gwei is 25x headroom
 * and costs essentially nothing extra.
 */
function useGasOverrides() {
  const chainId = useChainId();
  if (chainId !== ARBITRUM_SEPOLIA_ID) return {};
  return {
    maxFeePerGas: parseGwei("0.5"),
    maxPriorityFeePerGas: parseGwei("0.01"),
  };
}
import {
  TAGITCoreABI,
  AssetState,
  AssetStateNames,
  type Asset,
  type AssetStateType,
} from "./abis/TAGITCore";
import { TAGITAccessABI, Capabilities, CapabilityNames, type CapabilityHash } from "./abis/TAGITAccess";
import { IdentityBadgeABI, BadgeIds, BadgeIdNames, type BadgeId } from "./abis/IdentityBadge";
import {
  CapabilityBadgeABI,
  CapabilityIds,
  CapabilityIdNames,
  CapabilityIdList,
  CapabilityHashes,
  type CapabilityId,
} from "./abis/CapabilityBadge";

// ============================================================================
// TAGITCore Read Hooks
// ============================================================================

/**
 * Fetches asset data by token ID
 * Contract returns: (address assetOwner, uint64 timestamp, State state, uint8 flags, uint16 reserved)
 * @param tokenId - The asset token ID
 * @returns Asset data with loading and error states
 */
export function useAsset(tokenId: bigint) {
  const chainId = useChainId();
  const contracts = getContractsForChain(chainId);

  const result = useReadContract({
    address: contracts.TAGITCore,
    abi: TAGITCoreABI,
    functionName: "getAsset",
    args: [tokenId],
    chainId,
  });

  // Contract returns multiple values as an array: [owner, timestamp, state, flags, reserved]
  const data = result.data as
    | readonly [`0x${string}`, bigint, number, number, number]
    | undefined;

  const asset: Asset | undefined = data
    ? {
        owner: data[0],
        timestamp: data[1],
        state: data[2] as AssetStateType,
        flags: data[3],
        reserved: data[4],
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
 * Uses getAsset since there's no separate getState function
 * @param tokenId - The asset token ID
 * @returns State value and name with loading and error states
 */
export function useAssetState(tokenId: bigint) {
  const { asset, isLoading, error, refetch } = useAsset(tokenId);

  const state = asset?.state;
  const stateName = state !== undefined ? AssetStateNames[state] : undefined;

  return {
    state,
    stateName,
    isLoading,
    error,
    refetch,
  };
}

export function useAssetOwner(assetId: bigint) {
  const chainId = useChainId();
  const contracts = getContractsForChain(chainId);

  return useReadContract({
    address: contracts.TAGITCore,
    abi: TAGITCoreABI,
    functionName: "ownerOf",
    args: [assetId],
    chainId,
  });
}

export function useTotalSupply() {
  const chainId = useChainId();
  const contracts = getContractsForChain(chainId);

  return useReadContract({
    address: contracts.TAGITCore,
    abi: TAGITCoreABI,
    functionName: "totalSupply",
    chainId,
  });
}

export function useContractName() {
  const chainId = useChainId();
  const contracts = getContractsForChain(chainId);

  return useReadContract({
    address: contracts.TAGITCore,
    abi: TAGITCoreABI,
    functionName: "name",
    chainId,
  });
}

export function useContractSymbol() {
  const chainId = useChainId();
  const contracts = getContractsForChain(chainId);

  return useReadContract({
    address: contracts.TAGITCore,
    abi: TAGITCoreABI,
    functionName: "symbol",
    chainId,
  });
}

/**
 * Get the tag hash bound to a token
 * @param tokenId - The token ID
 */
export function useTagByToken(tokenId: bigint) {
  const chainId = useChainId();
  const contracts = getContractsForChain(chainId);

  return useReadContract({
    address: contracts.TAGITCore,
    abi: TAGITCoreABI,
    functionName: "getTagByToken",
    args: [tokenId],
    chainId,
  });
}

/**
 * Get the token ID for a given tag hash
 * @param tagHash - The tag hash (keccak256 of NFC UID)
 */
export function useTokenByTag(tagHash: `0x${string}`) {
  const chainId = useChainId();
  const contracts = getContractsForChain(chainId);

  return useReadContract({
    address: contracts.TAGITCore,
    abi: TAGITCoreABI,
    functionName: "getTokenByTag",
    args: [tagHash],
    chainId,
  });
}

/**
 * Fetches all assets with pagination support
 * Uses batch contract reads for efficiency
 * @param options.page - Page number (0-indexed)
 * @param options.pageSize - Items per page (default: 25)
 * @param options.refetchInterval - Auto-refresh interval in ms (default: 0 = disabled)
 */
export function useAllAssets(options?: {
  page?: number;
  pageSize?: number;
  refetchInterval?: number;
}) {
  const chainId = useChainId();
  const chainContracts = getContractsForChain(chainId);

  const page = options?.page ?? 0;
  const pageSize = options?.pageSize ?? 25;
  const refetchInterval = options?.refetchInterval ?? 0;

  // First get total supply to know how many assets exist
  const {
    data: totalSupply,
    isLoading: supplyLoading,
    error: supplyError,
  } = useReadContract({
    address: chainContracts.TAGITCore,
    abi: TAGITCoreABI,
    functionName: "totalSupply",
    chainId,
    query: {
      refetchInterval: refetchInterval > 0 ? refetchInterval : undefined,
    },
  });

  const total = totalSupply ? Number(totalSupply) : 0;
  const totalPages = Math.ceil(total / pageSize);

  // Calculate which tokenIds to fetch for this page
  // Token IDs start at 1, not 0
  const startId = page * pageSize + 1;
  const endId = Math.min(startId + pageSize - 1, total);

  // Build array of contract calls for batch fetching
  const contracts =
    total > 0 && startId <= total
      ? Array.from({ length: endId - startId + 1 }, (_, i) => ({
          address: chainContracts.TAGITCore as `0x${string}`,
          abi: TAGITCoreABI,
          functionName: "getAsset" as const,
          args: [BigInt(startId + i)],
          chainId,
        }))
      : [];

  // Batch fetch all assets for this page
  const {
    data: assetsData,
    isLoading: assetsLoading,
    error: assetsError,
    refetch,
  } = useReadContracts({
    contracts,
    query: {
      enabled: total > 0 && !supplyLoading,
      refetchInterval: refetchInterval > 0 ? refetchInterval : undefined,
    },
  });

  // Transform raw contract data into typed Asset objects
  // Contract returns: [owner, timestamp, state, flags, reserved]
  const assets: (Asset & { tokenId: bigint })[] = (assetsData ?? [])
    .map((result, index) => {
      if (result.status === "success" && result.result) {
        const data = result.result as readonly [`0x${string}`, bigint, number, number, number];
        return {
          tokenId: BigInt(startId + index),
          owner: data[0],
          timestamp: data[1],
          state: data[2] as AssetStateType,
          flags: data[3],
          reserved: data[4],
        };
      }
      return null;
    })
    .filter((asset): asset is Asset & { tokenId: bigint } => asset !== null);

  return {
    assets,
    totalSupply: total,
    page,
    pageSize,
    totalPages,
    hasNextPage: page < totalPages - 1,
    hasPrevPage: page > 0,
    isLoading: supplyLoading || assetsLoading,
    error: supplyError || assetsError,
    refetch,
  };
}

/**
 * Fetches assets filtered by state
 * @param state - The asset state to filter by
 * @param options.pageSize - Max items to return
 */
export function useAssetsByState(
  state: AssetStateType,
  options?: { pageSize?: number; refetchInterval?: number }
) {
  const pageSize = options?.pageSize ?? 50;
  const refetchInterval = options?.refetchInterval ?? 0;

  // Get all assets (up to pageSize * 2 to have buffer for filtering)
  const { assets, totalSupply, isLoading, error, refetch } = useAllAssets({
    pageSize: pageSize * 2,
    refetchInterval,
  });

  // Filter by state client-side
  const filteredAssets = assets.filter((asset) => asset.state === state).slice(0, pageSize);

  return {
    assets: filteredAssets,
    totalSupply,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Fetches flagged assets (state === FLAGGED)
 * Convenience wrapper for useAssetsByState
 * @param options.pageSize - Max items to return (default: 50)
 * @param options.refetchInterval - Auto-refresh interval in ms
 */
export function useFlaggedAssets(options?: { pageSize?: number; refetchInterval?: number }) {
  return useAssetsByState(AssetState.FLAGGED as AssetStateType, options);
}

// ============================================================================
// TAGITCore Write Hooks
// ============================================================================

export function useMint() {
  const chainId = useChainId();
  const contracts = getContractsForChain(chainId);
  const gasOverrides = useGasOverrides();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({
    hash,
    chainId,
    confirmations: 1,
    pollingInterval: 4_000,
  });

  // Extract tokenId from Transfer event in receipt
  const tokenId = useMemo(() => {
    if (!receipt?.logs) return null;
    const transferTopic = keccak256(toBytes("Transfer(address,address,uint256)"));
    for (const log of receipt.logs) {
      if (log.topics[0] === transferTopic && log.topics[3]) {
        return BigInt(log.topics[3]);
      }
    }
    return null;
  }, [receipt]);

  const mint = (to: `0x${string}`, metadataURI: string) => {
    const metadataHash = keccak256(toBytes(metadataURI));
    writeContract({
      address: contracts.TAGITCore,
      abi: TAGITCoreABI,
      functionName: "mint",
      args: [to, metadataHash],
      chainId,
      ...gasOverrides,
    });
  };

  return { mint, hash, isPending, isConfirming, isSuccess, error, tokenId };
}

export function useBindTag() {
  const chainId = useChainId();
  const contracts = getContractsForChain(chainId);
  const gasOverrides = useGasOverrides();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash, chainId, confirmations: 1, pollingInterval: 4_000 });
  const { data: walletClient } = useWalletClient();

  const bindTag = async (tokenId: bigint, tagHash: `0x${string}`) => {
    if (!walletClient) return;

    const challengeResponse = toHex(toBytes(`challenge${tokenId.toString()}`));
    const messageHash = keccak256(
      encodePacked(
        ["uint256", "bytes32", "bytes"],
        [tokenId, tagHash, challengeResponse]
      )
    );
    const oracleSignature = await walletClient.signMessage({
      message: { raw: toBytes(messageHash) },
    });

    writeContract({
      address: contracts.TAGITCore,
      abi: TAGITCoreABI,
      functionName: "bindTag",
      args: [tokenId, tagHash, challengeResponse, oracleSignature],
      chainId,
      ...gasOverrides,
    });
  };

  return { bindTag, hash, isPending, isConfirming, isSuccess, error };
}

export function useActivate() {
  const chainId = useChainId();
  const contracts = getContractsForChain(chainId);
  const gasOverrides = useGasOverrides();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash, chainId, confirmations: 1, pollingInterval: 4_000 });

  const activate = (tokenId: bigint) => {
    writeContract({
      address: contracts.TAGITCore,
      abi: TAGITCoreABI,
      functionName: "activate",
      args: [tokenId],
      chainId,
      ...gasOverrides,
    });
  };

  return { activate, hash, isPending, isConfirming, isSuccess, error };
}

/**
 * Claim an activated asset and transfer to new owner
 * @param tokenId - The asset token ID
 * @param newOwner - The address of the new owner
 */
export function useClaim() {
  const chainId = useChainId();
  const contracts = getContractsForChain(chainId);
  const gasOverrides = useGasOverrides();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash, chainId, confirmations: 1, pollingInterval: 4_000 });

  const claim = (tokenId: bigint, newOwner: `0x${string}`) => {
    writeContract({
      address: contracts.TAGITCore,
      abi: TAGITCoreABI,
      functionName: "claim",
      args: [tokenId, newOwner],
      chainId,
      ...gasOverrides,
    });
  };

  return { claim, hash, isPending, isConfirming, isSuccess, error };
}

/**
 * Flag a claimed asset as lost/stolen/recall
 * @param tokenId - The asset token ID to flag
 */
export function useFlag() {
  const chainId = useChainId();
  const contracts = getContractsForChain(chainId);
  const gasOverrides = useGasOverrides();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash, chainId, confirmations: 1, pollingInterval: 4_000 });

  const flag = (tokenId: bigint) => {
    writeContract({
      address: contracts.TAGITCore,
      abi: TAGITCoreABI,
      functionName: "flag",
      args: [tokenId],
      chainId,
      ...gasOverrides,
    });
  };

  return { flag, hash, isPending, isConfirming, isSuccess, error };
}

/**
 * Approve resolution of a flagged asset (quorum step)
 * Must be called before resolve() can execute.
 * @param tokenId - The asset token ID
 * @param newOwner - The proposed rightful owner
 */
export function useApproveResolve() {
  const chainId = useChainId();
  const contracts = getContractsForChain(chainId);
  const gasOverrides = useGasOverrides();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash, chainId, confirmations: 1, pollingInterval: 4_000 });

  const approveResolve = (tokenId: bigint, newOwner: `0x${string}`) => {
    writeContract({
      address: contracts.TAGITCore,
      abi: TAGITCoreABI,
      functionName: "approveResolve",
      args: [tokenId, newOwner],
      chainId,
      ...gasOverrides,
    });
  };

  return { approveResolve, hash, isPending, isConfirming, isSuccess, error };
}

/**
 * Resolve a flagged asset and transfer to rightful owner
 * Requires quorum approval via approveResolve() first.
 * @param tokenId - The asset token ID
 * @param newOwner - The address of the rightful owner
 */
export function useResolve() {
  const chainId = useChainId();
  const contracts = getContractsForChain(chainId);
  const gasOverrides = useGasOverrides();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash, chainId, confirmations: 1, pollingInterval: 4_000 });

  const resolve = (tokenId: bigint, newOwner: `0x${string}`) => {
    writeContract({
      address: contracts.TAGITCore,
      abi: TAGITCoreABI,
      functionName: "resolve",
      args: [tokenId, newOwner],
      chainId,
      ...gasOverrides,
    });
  };

  return { resolve, hash, isPending, isConfirming, isSuccess, error };
}

export function useRecycle() {
  const chainId = useChainId();
  const contracts = getContractsForChain(chainId);
  const gasOverrides = useGasOverrides();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash, chainId, confirmations: 1, pollingInterval: 4_000 });

  const recycle = (tokenId: bigint) => {
    writeContract({
      address: contracts.TAGITCore,
      abi: TAGITCoreABI,
      functionName: "recycle",
      args: [tokenId],
      chainId,
      ...gasOverrides,
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
  const chainId = useChainId();
  const contracts = getContractsForChain(chainId);

  const result = useReadContract({
    address: contracts.TAGITAccess,
    abi: TAGITAccessABI,
    functionName: "hasCapability",
    args: address ? [address, capability] : undefined,
    chainId,
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
  const chainId = useChainId();
  const contracts = getContractsForChain(chainId);

  const result = useReadContract({
    address: contracts.TAGITAccess,
    abi: TAGITAccessABI,
    functionName: "getCapabilities",
    args: address ? [address] : undefined,
    chainId,
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
  const chainId = useChainId();
  const contracts = getContractsForChain(chainId);
  const gasOverrides = useGasOverrides();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash, chainId, confirmations: 1, pollingInterval: 4_000 });

  const grantCapability = (user: `0x${string}`, capabilityId: CapabilityId) => {
    writeContract({
      address: contracts.CapabilityBadge,
      abi: CapabilityBadgeABI,
      functionName: "grantCapability",
      args: [user, BigInt(capabilityId)],
      chainId,
      ...gasOverrides,
    });
  };

  return { grantCapability, hash, isPending, isConfirming, isSuccess, error };
}

export function useRevokeCapability() {
  const chainId = useChainId();
  const contracts = getContractsForChain(chainId);
  const gasOverrides = useGasOverrides();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash, chainId, confirmations: 1, pollingInterval: 4_000 });

  const revokeCapability = (user: `0x${string}`, capabilityId: CapabilityId) => {
    writeContract({
      address: contracts.CapabilityBadge,
      abi: CapabilityBadgeABI,
      functionName: "revokeCapability",
      args: [user, BigInt(capabilityId)],
      chainId,
      ...gasOverrides,
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
  const chainId = useChainId();
  const contracts = getContractsForChain(chainId);

  const result = useReadContract({
    address: contracts.IdentityBadge,
    abi: IdentityBadgeABI,
    functionName: "balanceOf",
    args: address ? [address, BigInt(badgeId)] : undefined,
    chainId,
    query: {
      enabled: !!address,
    },
  });

  const balance = result.data as bigint | undefined;

  return {
    hasBadge: balance !== undefined && balance > BigInt(0),
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
  const chainId = useChainId();
  const contracts = getContractsForChain(chainId);

  const result = useReadContract({
    address: contracts.IdentityBadge,
    abi: IdentityBadgeABI,
    functionName: "getBadges",
    args: address ? [address] : undefined,
    chainId,
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
  const chainId = useChainId();
  const contracts = getContractsForChain(chainId);
  const gasOverrides = useGasOverrides();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash, chainId, confirmations: 1, pollingInterval: 4_000 });

  const grantBadge = (to: `0x${string}`, badgeId: number) => {
    writeContract({
      address: contracts.IdentityBadge,
      abi: IdentityBadgeABI,
      functionName: "grantIdentity",
      args: [to, BigInt(badgeId)],
      chainId,
      ...gasOverrides,
    });
  };

  return { grantBadge, hash, isPending, isConfirming, isSuccess, error };
}

export function useRevokeBadge() {
  const chainId = useChainId();
  const contracts = getContractsForChain(chainId);
  const gasOverrides = useGasOverrides();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash, chainId, confirmations: 1, pollingInterval: 4_000 });

  const revokeBadge = (from: `0x${string}`, badgeId: number) => {
    writeContract({
      address: contracts.IdentityBadge,
      abi: IdentityBadgeABI,
      functionName: "revokeIdentity",
      args: [from, BigInt(badgeId)],
      chainId,
      ...gasOverrides,
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
  const chainId = useChainId();
  const contracts = getContractsForChain(chainId);

  return useReadContract({
    address: contracts.CapabilityBadge,
    abi: CapabilityBadgeABI,
    functionName: "balanceOf",
    args: address ? [address, BigInt(capabilityId)] : undefined,
    chainId,
    query: {
      enabled: !!address,
    },
  });
}

// Re-export types and constants for convenience
export {
  AssetState,
  AssetStateNames,
  Capabilities,
  CapabilityNames,
  BadgeIds,
  BadgeIdNames,
  CapabilityIds,
  CapabilityIdNames,
  CapabilityIdList,
  CapabilityHashes,
};
export type { Asset, AssetStateType, CapabilityHash, BadgeId, CapabilityId };
