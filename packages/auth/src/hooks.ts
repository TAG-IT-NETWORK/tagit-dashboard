import { useAccount } from "wagmi";
import {
  useCapabilities as useContractCapabilities,
  useCapabilityGate,
  useBadges,
  useBadgeCheck,
  Capabilities,
  BadgeIdNames,
  type CapabilityHash,
} from "@tagit/contracts";
import {
  type CapabilityKey,
  type BadgeInfo,
  type CurrentUser,
  CapabilityKeys,
  getCapabilityKey,
  BadgeCapabilities,
} from "./types";

/**
 * Returns all badges for the connected wallet or specified address
 */
export function useUserBadges(address?: `0x${string}`) {
  const { address: connectedAddress } = useAccount();
  const targetAddress = address || connectedAddress;

  const { badges, badgeIds, isLoading, error, refetch } = useBadges(targetAddress);

  return {
    badges,
    badgeIds,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Returns capabilities for the connected wallet or specified address
 */
export function useUserCapabilities(address?: `0x${string}`) {
  const { address: connectedAddress } = useAccount();
  const targetAddress = address || connectedAddress;

  const { capabilities: rawCapabilities, isLoading, error, refetch } = useContractCapabilities(targetAddress);

  // Convert capability hashes to keys
  const capabilities: CapabilityKey[] = [];
  for (const hash of rawCapabilities) {
    const key = getCapabilityKey(hash as CapabilityHash);
    if (key) {
      capabilities.push(key);
    }
  }

  return {
    capabilities,
    capabilityHashes: rawCapabilities,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Checks if the connected wallet can perform a specific capability
 */
export function useCanPerform(capability: CapabilityKey, address?: `0x${string}`) {
  const { address: connectedAddress, isConnected } = useAccount();
  const targetAddress = address || connectedAddress;

  const capabilityHash = Capabilities[capability];
  const { hasCapability, isLoading, error } = useCapabilityGate(targetAddress, capabilityHash);

  // CLAIMER and FLAGGER are public capabilities - any connected wallet can use them
  const isPublicCapability = capability === "CLAIMER" || capability === "FLAGGER";

  return {
    canPerform: hasCapability || (isPublicCapability && isConnected),
    isLoading,
    error,
  };
}

/**
 * Returns the current user's complete profile including address, badges, and capabilities.
 * Aggregates wallet state from wagmi useAccount, fetches all badge balances, and capability checks.
 * Cached with TanStack Query (5 min stale time via wagmi defaults).
 */
export function useCurrentUser(): CurrentUser {
  const { address, isConnected } = useAccount();

  // Fetch badges
  const { badges: rawBadges, isLoading: badgesLoading } = useBadges(address);

  // Fetch capabilities
  const { capabilities: rawCapabilities, isLoading: capabilitiesLoading } = useUserCapabilities(address);

  // Transform badges to BadgeInfo format
  const badges: BadgeInfo[] = rawBadges.map((badge) => ({
    id: badge.id,
    name: badge.name,
  }));

  // Derive capabilities from badges
  const badgeCapabilities = new Set<CapabilityKey>();
  for (const badge of badges) {
    const caps = BadgeCapabilities[badge.id] ?? [];
    for (const cap of caps) {
      badgeCapabilities.add(cap);
    }
  }

  // Merge badge-derived capabilities with explicit capabilities
  const allCapabilities = new Set([...badgeCapabilities, ...rawCapabilities]);

  // Any connected wallet has CLAIMER and FLAGGER capabilities
  if (isConnected) {
    allCapabilities.add("CLAIMER");
    allCapabilities.add("FLAGGER");
  }

  return {
    address,
    isConnected,
    badges,
    capabilities: Array.from(allCapabilities),
    isLoading: badgesLoading || capabilitiesLoading,
  };
}

/**
 * Check if user has a specific badge
 */
export function useHasBadge(badgeId: number, address?: `0x${string}`) {
  const { address: connectedAddress } = useAccount();
  const targetAddress = address || connectedAddress;

  return useBadgeCheck(targetAddress, badgeId);
}

/**
 * Check if user has a specific capability
 */
export function useHasCapability(capability: CapabilityKey, address?: `0x${string}`) {
  const { address: connectedAddress } = useAccount();
  const targetAddress = address || connectedAddress;

  const capabilityHash = Capabilities[capability];
  return useCapabilityGate(targetAddress, capabilityHash);
}

/**
 * Returns all permissions for the current user with convenience booleans
 */
export function usePermissions(address?: `0x${string}`) {
  const { address: connectedAddress, isConnected } = useAccount();
  const targetAddress = address || connectedAddress;

  const { badges, isLoading: badgesLoading } = useBadges(targetAddress);
  const { capabilities, isLoading: capabilitiesLoading } = useUserCapabilities(targetAddress);

  const isLoading = badgesLoading || capabilitiesLoading;

  // Derive capabilities from badges
  const badgeCapabilities = new Set<CapabilityKey>();
  for (const badge of badges) {
    const caps = BadgeCapabilities[badge.id] ?? [];
    for (const cap of caps) {
      badgeCapabilities.add(cap);
    }
  }

  // Merge with explicit capabilities
  const allCapabilities = new Set([...badgeCapabilities, ...capabilities]);

  // Public capabilities for connected users
  if (isConnected) {
    allCapabilities.add("CLAIMER");
    allCapabilities.add("FLAGGER");
  }

  // Check for specific badge types
  const badgeIds = badges.map((b) => b.id);
  const hasGovMil = badgeIds.includes(20);
  const hasLawEnforcement = badgeIds.includes(21);
  const hasManufacturer = badgeIds.includes(10);
  const hasRetailer = badgeIds.includes(11);

  return {
    isConnected,
    badges,
    capabilities: Array.from(allCapabilities),
    canMint: allCapabilities.has("MINTER"),
    canBind: allCapabilities.has("BINDER"),
    canActivate: allCapabilities.has("ACTIVATOR"),
    canClaim: allCapabilities.has("CLAIMER"),
    canFlag: allCapabilities.has("FLAGGER"),
    canResolve: allCapabilities.has("RESOLVER"),
    canRecycle: allCapabilities.has("RECYCLER"),
    isGovMil: hasGovMil,
    isLawEnforcement: hasLawEnforcement,
    isManufacturer: hasManufacturer,
    isRetailer: hasRetailer,
    isLoading,
  };
}
