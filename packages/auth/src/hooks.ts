import { useAccount } from "wagmi";
import {
  useIdentityBadgeType,
  useHasCapability as useContractHasCapability,
  useCapabilities as useContractCapabilities,
} from "@tagit/contracts";
import { IdentityBadgeType, Capability, BadgeCapabilities } from "./types";

/**
 * Returns the identity badge type for the given address or connected wallet
 */
export function useIdentityBadge(address?: `0x${string}`) {
  const { address: connectedAddress } = useAccount();
  const targetAddress = address || connectedAddress;

  const { data: badgeType, isLoading, error } = useIdentityBadgeType(targetAddress);

  return {
    badgeType: (badgeType as IdentityBadgeType) ?? IdentityBadgeType.NONE,
    isLoading,
    error,
    hasBadge: badgeType !== undefined && badgeType !== IdentityBadgeType.NONE,
  };
}

/**
 * Returns array of capabilities for the given address or connected wallet
 */
export function useCapabilities(address?: `0x${string}`) {
  const { address: connectedAddress } = useAccount();
  const targetAddress = address || connectedAddress;

  const { data: capabilities, isLoading, error } = useContractCapabilities(targetAddress);

  return {
    capabilities: (capabilities as bigint[])?.map((c) => Number(c) as Capability) ?? [],
    isLoading,
    error,
  };
}

/**
 * Checks if the given address or connected wallet can perform a specific capability
 */
export function useCanPerform(capability: Capability, address?: `0x${string}`) {
  const { address: connectedAddress } = useAccount();
  const targetAddress = address || connectedAddress;

  const { data: hasCapability, isLoading, error } = useContractHasCapability(
    targetAddress,
    capability
  );

  // Consumers (no badge) can always CLAIM and FLAG
  const isPublicCapability =
    capability === Capability.CLAIM || capability === Capability.FLAG;

  return {
    canPerform: hasCapability === true || (isPublicCapability && !!targetAddress),
    isLoading,
    error,
  };
}

/**
 * Returns all permissions for the current user based on their badge and capabilities
 */
export function usePermissions(address?: `0x${string}`) {
  const { address: connectedAddress, isConnected } = useAccount();
  const targetAddress = address || connectedAddress;

  const { badgeType, isLoading: badgeLoading } = useIdentityBadge(targetAddress);
  const { capabilities, isLoading: capabilitiesLoading } = useCapabilities(targetAddress);

  const isLoading = badgeLoading || capabilitiesLoading;

  // Get default capabilities from badge type
  const badgeCapabilities = BadgeCapabilities[badgeType] ?? [];

  // Merge with explicit capabilities from contract
  const allCapabilities = new Set([...badgeCapabilities, ...capabilities]);

  return {
    isConnected,
    badgeType,
    capabilities: Array.from(allCapabilities),
    canMint: allCapabilities.has(Capability.MINT),
    canBind: allCapabilities.has(Capability.BIND),
    canActivate: allCapabilities.has(Capability.ACTIVATE),
    canClaim: allCapabilities.has(Capability.CLAIM) || isConnected,
    canFlag: allCapabilities.has(Capability.FLAG) || isConnected,
    canResolve: allCapabilities.has(Capability.RESOLVE),
    canRecycle: allCapabilities.has(Capability.RECYCLE),
    isAdmin: badgeType === IdentityBadgeType.ADMIN,
    isGovMil: badgeType === IdentityBadgeType.GOV_MIL,
    isManufacturer: badgeType === IdentityBadgeType.MANUFACTURER,
    isRetailer: badgeType === IdentityBadgeType.RETAILER,
    isRecycler: badgeType === IdentityBadgeType.RECYCLER,
    isLoading,
  };
}
