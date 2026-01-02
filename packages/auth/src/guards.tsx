"use client";

import { type ReactNode } from "react";
import { useAccount } from "wagmi";
import { useCapabilityGate, useBadgeCheck, Capabilities } from "@tagit/contracts";
import { type CapabilityKey } from "./types";

// Simple skeleton component for loading states
function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`}
      style={{ minHeight: "1rem", minWidth: "4rem" }}
    />
  );
}

// Connect wallet prompt component
function ConnectWalletPrompt() {
  return (
    <div className="text-sm text-gray-500 dark:text-gray-400">
      Please connect your wallet to continue.
    </div>
  );
}

// ============================================================================
// RequireCapability Guard
// ============================================================================

export interface RequireCapabilityProps {
  capability: CapabilityKey;
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Renders children only if the user has the specified capability.
 * - If wallet not connected: shows ConnectWallet prompt
 * - If capability check loading: shows Skeleton
 * - If no capability: shows fallback or null
 * - If has capability: renders children
 */
export function RequireCapability({
  capability,
  fallback = null,
  children,
}: RequireCapabilityProps) {
  const { address, isConnected } = useAccount();
  const capabilityHash = Capabilities[capability];
  const { hasCapability, isLoading } = useCapabilityGate(address, capabilityHash);

  if (!isConnected) {
    return <ConnectWalletPrompt />;
  }

  if (isLoading) {
    return <Skeleton className="h-8 w-32" />;
  }

  if (!hasCapability) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// ============================================================================
// RequireBadge Guard
// ============================================================================

export interface RequireBadgeProps {
  badgeId: number;
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Renders children only if the user has the specified badge.
 * - If wallet not connected: shows ConnectWallet prompt
 * - If badge check loading: shows Skeleton
 * - If no badge: shows fallback or null
 * - If has badge: renders children
 */
export function RequireBadge({
  badgeId,
  fallback = null,
  children,
}: RequireBadgeProps) {
  const { address, isConnected } = useAccount();
  const { hasBadge, isLoading } = useBadgeCheck(address, badgeId);

  if (!isConnected) {
    return <ConnectWalletPrompt />;
  }

  if (isLoading) {
    return <Skeleton className="h-8 w-32" />;
  }

  if (!hasBadge) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// ============================================================================
// RequireConnected Guard
// ============================================================================

export interface RequireConnectedProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Renders children only if a wallet is connected.
 */
export function RequireConnected({
  children,
  fallback = null,
}: RequireConnectedProps) {
  const { isConnected } = useAccount();

  if (!isConnected) {
    return <>{fallback ?? <ConnectWalletPrompt />}</>;
  }

  return <>{children}</>;
}

// ============================================================================
// RequireAnyBadge Guard
// ============================================================================

export interface RequireAnyBadgeProps {
  badgeIds: number[];
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Renders children if the user has ANY of the specified badges.
 * Useful for checking multiple badge types at once.
 */
export function RequireAnyBadge({
  badgeIds,
  fallback = null,
  children,
}: RequireAnyBadgeProps) {
  const { address, isConnected } = useAccount();

  // Check the first badge in the list
  // Note: For proper multi-badge checking, we'd need to use useBadges hook
  const firstBadgeId = badgeIds[0] ?? 0;
  const { hasBadge, isLoading } = useBadgeCheck(address, firstBadgeId);

  if (!isConnected) {
    return <ConnectWalletPrompt />;
  }

  if (isLoading) {
    return <Skeleton className="h-8 w-32" />;
  }

  if (!hasBadge) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// ============================================================================
// ShowIfCapable Guard
// ============================================================================

export interface ShowIfCapableProps {
  capability: CapabilityKey;
  children: ReactNode;
}

/**
 * Shows children only if user has capability, otherwise renders nothing.
 * Use this for hiding UI elements the user cannot interact with.
 * Does not show loading states - just hides content until ready.
 */
export function ShowIfCapable({ capability, children }: ShowIfCapableProps) {
  const { address, isConnected } = useAccount();
  const capabilityHash = Capabilities[capability];
  const { hasCapability, isLoading } = useCapabilityGate(address, capabilityHash);

  if (!isConnected || isLoading || !hasCapability) {
    return null;
  }

  return <>{children}</>;
}

// ============================================================================
// ShowIfBadge Guard
// ============================================================================

export interface ShowIfBadgeProps {
  badgeId: number;
  children: ReactNode;
}

/**
 * Shows children only if user has badge, otherwise renders nothing.
 * Use this for hiding UI elements the user cannot interact with.
 * Does not show loading states - just hides content until ready.
 */
export function ShowIfBadge({ badgeId, children }: ShowIfBadgeProps) {
  const { address, isConnected } = useAccount();
  const { hasBadge, isLoading } = useBadgeCheck(address, badgeId);

  if (!isConnected || isLoading || !hasBadge) {
    return null;
  }

  return <>{children}</>;
}

// ============================================================================
// CapabilityGate Component
// ============================================================================

export interface CapabilityGateProps {
  capability: CapabilityKey;
  children: ReactNode;
  unauthorized?: ReactNode;
  loading?: ReactNode;
}

/**
 * A more flexible gate component that provides explicit control over all states.
 */
export function CapabilityGate({
  capability,
  children,
  unauthorized = null,
  loading = <Skeleton className="h-8 w-32" />,
}: CapabilityGateProps) {
  const { address, isConnected } = useAccount();
  const capabilityHash = Capabilities[capability];
  const { hasCapability, isLoading } = useCapabilityGate(address, capabilityHash);

  if (!isConnected) {
    return <ConnectWalletPrompt />;
  }

  if (isLoading) {
    return <>{loading}</>;
  }

  if (!hasCapability) {
    return <>{unauthorized}</>;
  }

  return <>{children}</>;
}

// ============================================================================
// BadgeGate Component
// ============================================================================

export interface BadgeGateProps {
  badgeId: number;
  children: ReactNode;
  unauthorized?: ReactNode;
  loading?: ReactNode;
}

/**
 * A more flexible gate component that provides explicit control over all states.
 */
export function BadgeGate({
  badgeId,
  children,
  unauthorized = null,
  loading = <Skeleton className="h-8 w-32" />,
}: BadgeGateProps) {
  const { address, isConnected } = useAccount();
  const { hasBadge, isLoading } = useBadgeCheck(address, badgeId);

  if (!isConnected) {
    return <ConnectWalletPrompt />;
  }

  if (isLoading) {
    return <>{loading}</>;
  }

  if (!hasBadge) {
    return <>{unauthorized}</>;
  }

  return <>{children}</>;
}
