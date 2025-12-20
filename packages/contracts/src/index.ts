// Addresses
export { CHAIN_ID, CONTRACTS, type ContractName } from "./addresses";

// ABIs
export {
  TAGITCoreABI,
  TAGITAccessABI,
  IdentityBadgeABI,
  CapabilityBadgeABI,
} from "./abis";

// Hooks
export {
  // TAGITCore
  useAsset,
  useAssetState,
  useAssetOwner,
  useTotalSupply,
  useContractName,
  useContractSymbol,
  useMint,
  useBindTag,
  useActivate,
  useClaim,
  useFlag,
  useResolve,
  useRecycle,
  // TAGITAccess
  useHasCapability,
  useCapabilities,
  // IdentityBadge
  useIdentityBadgeType,
  useHasBadge,
  // CapabilityBadge
  useCapabilityBadgeBalance,
} from "./hooks";

// Asset state enum
export const AssetState = {
  MINTED: 0,
  BOUND: 1,
  ACTIVATED: 2,
  CLAIMED: 3,
  FLAGGED: 4,
  RECYCLED: 5,
} as const;

export type AssetStateType = (typeof AssetState)[keyof typeof AssetState];

// Asset state names for display
export const AssetStateNames: Record<AssetStateType, string> = {
  [AssetState.MINTED]: "Minted",
  [AssetState.BOUND]: "Bound",
  [AssetState.ACTIVATED]: "Activated",
  [AssetState.CLAIMED]: "Claimed",
  [AssetState.FLAGGED]: "Flagged",
  [AssetState.RECYCLED]: "Recycled",
};

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
