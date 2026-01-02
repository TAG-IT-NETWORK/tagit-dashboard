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
  // TAGITAccess types and constants
  Capabilities,
  CapabilityNames,
  CapabilityList,
  type CapabilityKey,
  type CapabilityHash,
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
