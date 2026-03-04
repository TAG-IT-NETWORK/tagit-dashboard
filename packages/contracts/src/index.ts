// Addresses
export {
  CHAIN_ID,
  CONTRACTS,
  OP_SEPOLIA_CHAIN_ID,
  ARBITRUM_SEPOLIA_CHAIN_ID,
  getContractsForChain,
  getContractAddress,
  START_BLOCKS,
  ARBITRUM_START_BLOCKS,
  startBlocksByChain,
  type ContractName,
  type ContractAddresses,
} from "./addresses";

// ABIs
export {
  TAGITCoreABI,
  TAGITAccessABI,
  IdentityBadgeABI,
  CapabilityBadgeABI,
  // TAGITCore types and constants
  AssetState,
  AssetStateNames,
  type AssetStateType,
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
  // NIST Phase 3 ABIs
  TAGITStakingABI,
  TAGITTreasuryABI,
  TAGITRecoveryABI,
  TAGITProgramsABI,
  // TAGITTreasury types
  WithdrawalStatus,
  WithdrawalStatusNames,
  type WithdrawalStatusType,
  type Allocation,
  type PendingWithdrawal,
  // TAGITRecovery types
  CaseStatus,
  CaseStatusNames,
  type CaseStatusType,
  type RecoveryCase,
  type Vote,
  // TAGITPrograms types
  ReputationTier,
  ReputationTierNames,
  ReputationTierMultipliers,
  type ReputationTierType,
  type Program,
  type UserReputation,
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
  useTagByToken,
  useTokenByTag,
  useAllAssets,
  useAssetsByState,
  useFlaggedAssets,
  // TAGITCore Write
  useMint,
  useBindTag,
  useActivate,
  useClaim,
  useFlag,
  useApproveResolve,
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
  useRecentTransfers,
  useRecentFlags,
  useTopUsers,
  useDailyMints,
  useActiveUsers,
  useDashboardData,
  useEventFeedWithFallback,
  useAssetHistory,
  // Client
  getSubgraphClient,
  isSubgraphAvailable,
  // RPC fallback
  fetchRecentEvents,
  // Types
  type DashboardStats,
  type StateDistribution,
  type ActivityItem,
  type FlagItem,
  type TopUser,
  type TransferItem,
  type FeedEvent,
  type EventSource,
  type AssetTimelineEvent,
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

// Block explorer URLs (chain-aware)
const explorerBaseUrls: Record<number, string> = {
  421614: "https://sepolia.arbiscan.io",
  11155420: "https://optimism-sepolia.blockscout.com",
};

export function getExplorerUrl(chainId: number): string {
  return explorerBaseUrls[chainId] ?? explorerBaseUrls[11155420];
}

export function getExplorerTxUrl(chainId: number, hash: string): string {
  return `${getExplorerUrl(chainId)}/tx/${hash}`;
}

export function getExplorerAddressUrl(chainId: number, address: string): string {
  return `${getExplorerUrl(chainId)}/address/${address}`;
}

/** @deprecated Use getExplorerTxUrl(chainId, hash) */
export function getBlockscoutTxUrl(hash: string): string {
  return `https://optimism-sepolia.blockscout.com/tx/${hash}`;
}

/** @deprecated Use getExplorerAddressUrl(chainId, address) */
export function getBlockscoutAddressUrl(address: string): string {
  return `https://optimism-sepolia.blockscout.com/address/${address}`;
}
