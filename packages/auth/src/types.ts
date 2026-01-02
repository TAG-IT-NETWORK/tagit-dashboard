import {
  Capabilities,
  CapabilityNames as ContractCapabilityNames,
  type CapabilityHash,
  type CapabilityKey,
  BadgeIds,
  BadgeIdNames,
  type BadgeId,
} from "@tagit/contracts";

// Re-export from contracts for convenience
export { Capabilities, BadgeIds };
export type { CapabilityHash, CapabilityKey, BadgeId };

// All capability keys as array
export const CapabilityKeys: CapabilityKey[] = [
  "MINTER",
  "BINDER",
  "ACTIVATOR",
  "CLAIMER",
  "FLAGGER",
  "RESOLVER",
  "RECYCLER",
];

// Capability display names (from contracts)
export const CapabilityDisplayNames = ContractCapabilityNames;

// Badge display names (from contracts)
export const BadgeDisplayNames = BadgeIdNames;

// Badge info for display
export interface BadgeInfo {
  id: number;
  name: string;
}

// User capabilities info
export interface CapabilityInfo {
  key: CapabilityKey;
  hash: CapabilityHash;
  name: string;
}

// Current user state
export interface CurrentUser {
  address: `0x${string}` | undefined;
  isConnected: boolean;
  badges: BadgeInfo[];
  capabilities: CapabilityKey[];
  isLoading: boolean;
}

// Capability to key lookup
export function getCapabilityKey(hash: CapabilityHash): CapabilityKey | undefined {
  for (const key of CapabilityKeys) {
    if (Capabilities[key] === hash) {
      return key;
    }
  }
  return undefined;
}

// Key to capability hash lookup
export function getCapabilityHash(key: CapabilityKey): CapabilityHash {
  return Capabilities[key];
}

// Badge capabilities mapping - which capabilities each badge grants
export const BadgeCapabilities: Record<number, CapabilityKey[]> = {
  [BadgeIds.KYC_L1]: ["CLAIMER", "FLAGGER"],
  [BadgeIds.KYC_L2]: ["CLAIMER", "FLAGGER"],
  [BadgeIds.KYC_L3]: ["CLAIMER", "FLAGGER"],
  [BadgeIds.MANUFACTURER]: ["MINTER", "BINDER"],
  [BadgeIds.RETAILER]: ["ACTIVATOR"],
  [BadgeIds.GOV_MIL]: ["MINTER", "BINDER", "ACTIVATOR", "CLAIMER", "FLAGGER", "RESOLVER", "RECYCLER"],
  [BadgeIds.LAW_ENFORCEMENT]: ["FLAGGER", "RESOLVER"],
};
