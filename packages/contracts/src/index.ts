// Addresses
export { CHAIN_ID, CONTRACTS, type ContractName } from "./addresses";

// ABIs
export {
  TAGITCoreABI,
  TAGITAccessABI,
  IdentityBadgeABI,
  CapabilityBadgeABI,
  // TAGITCore types and constants
  AssetState,
  AssetStateNames,
  Resolution,
  ResolutionNames,
  type AssetStateType,
  type ResolutionType,
  type Asset,
  // TAGITAccess types and constants (bytes32 hashes for reading)
  Capabilities,
  CapabilityNames,
  CapabilityList,
  type CapabilityKey,
  type CapabilityHash,
  // CapabilityBadge types and constants (keccak256 hashes as IDs)
  CapabilityIds,
  CapabilityIdNames,
  CapabilityIdList,
  CapabilityHashes,
  capabilityHashToBigInt,
  type CapabilityId,
  // IdentityBadge types and constants
  BadgeIds,
  BadgeIdNames,
  BadgeIdList,
  BadgeCategories,
  type BadgeId,
} from "./abis";

// Hooks
export {
  // TAGITCore Read
  useAsset,
  useAssetState,
  useAssetOwner,
  useTotalSupply,
  useContractName,
  useContractSymbol,
  useAllAssets,
  useAssetsByState,
  useFlaggedAssets,
  // TAGITCore Write
  useMint,
  useBindTag,
  useActivate,
  useClaim,
  useFlag,
  useResolve,
  useRecycle,
  // TAGITAccess
  useCapabilityGate,
  useCapabilities,
  useGrantCapability,
  useRevokeCapability,
  // IdentityBadge
  useBadgeCheck,
  useBadges,
  useGrantBadge,
  useRevokeBadge,
  // CapabilityBadge
  useCapabilityBadgeBalance,
} from "./hooks";

// Re-export wagmi hooks to ensure same instance is used across the app
export { useAccount, useConfig } from "wagmi";

// Subgraph hooks for indexed data
export {
  // Hooks
  useGlobalStats,
  useStateDistribution,
  useRecentActivity,
  useRecentFlags,
  useTopUsers,
  useDailyMints,
  useActiveUsers,
  useDashboardData,
  // Client
  getSubgraphClient,
  isSubgraphAvailable,
  // Types
  type DashboardStats,
  type StateDistribution,
  type ActivityItem,
  type FlagItem,
  type TopUser,
} from "./subgraph";

// Error handling utilities
export {
  TAGIT_ERRORS,
  TRANSACTION_ERRORS,
  parseContractError,
  formatTransactionError,
  getActionDescription,
} from "./errors";

// Utility functions
export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function shortenHash(hash: string, chars = 6): string {
  return `${hash.slice(0, chars + 2)}...${hash.slice(-chars)}`;
}

// Block explorer URLs
const BLOCKSCOUT_URL = "https://optimism-sepolia.blockscout.com";

export function getBlockscoutTxUrl(hash: string): string {
  return `${BLOCKSCOUT_URL}/tx/${hash}`;
}

export function getBlockscoutAddressUrl(address: string): string {
  return `${BLOCKSCOUT_URL}/address/${address}`;
}
