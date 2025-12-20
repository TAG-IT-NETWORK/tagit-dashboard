"use client";

import { type ReactNode } from "react";
import { useCanPerform, useIdentityBadge, usePermissions } from "./hooks";
import { Capability, IdentityBadgeType } from "./types";

interface RequireCapabilityProps {
  capability: Capability;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Renders children only if the user has the specified capability
 */
export function RequireCapability({
  capability,
  children,
  fallback = null,
}: RequireCapabilityProps) {
  const { canPerform, isLoading } = useCanPerform(capability);

  if (isLoading) {
    return fallback;
  }

  if (!canPerform) {
    return fallback;
  }

  return <>{children}</>;
}

interface RequireBadgeProps {
  badgeTypes: IdentityBadgeType[];
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Renders children only if the user has one of the specified badge types
 */
export function RequireBadge({
  badgeTypes,
  children,
  fallback = null,
}: RequireBadgeProps) {
  const { badgeType, isLoading } = useIdentityBadge();

  if (isLoading) {
    return fallback;
  }

  if (!badgeTypes.includes(badgeType)) {
    return fallback;
  }

  return <>{children}</>;
}

interface RequireConnectedProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Renders children only if a wallet is connected
 */
export function RequireConnected({
  children,
  fallback = null,
}: RequireConnectedProps) {
  const { isConnected } = usePermissions();

  if (!isConnected) {
    return fallback;
  }

  return <>{children}</>;
}

interface RequireAdminProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Renders children only if the user is an Admin or Gov/Mil
 */
export function RequireAdmin({ children, fallback = null }: RequireAdminProps) {
  const { isAdmin, isGovMil, isLoading } = usePermissions();

  if (isLoading) {
    return fallback;
  }

  if (!isAdmin && !isGovMil) {
    return fallback;
  }

  return <>{children}</>;
}

interface ShowIfCapableProps {
  capability: Capability;
  children: ReactNode;
}

/**
 * Shows children only if user has capability, otherwise renders nothing.
 * Use this for hiding UI elements the user cannot interact with.
 */
export function ShowIfCapable({ capability, children }: ShowIfCapableProps) {
  const { canPerform, isLoading } = useCanPerform(capability);

  if (isLoading || !canPerform) {
    return null;
  }

  return <>{children}</>;
}
