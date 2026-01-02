// Types
export {
  Capabilities,
  BadgeIds,
  CapabilityKeys,
  CapabilityDisplayNames,
  BadgeDisplayNames,
  BadgeCapabilities,
  getCapabilityKey,
  getCapabilityHash,
  type CapabilityHash,
  type CapabilityKey,
  type BadgeId,
  type BadgeInfo,
  type CapabilityInfo,
  type CurrentUser,
} from "./types";

// Hooks
export {
  useCurrentUser,
  useUserBadges,
  useUserCapabilities,
  useCanPerform,
  useHasBadge,
  useHasCapability,
  usePermissions,
} from "./hooks";

// Guards
export {
  RequireCapability,
  RequireBadge,
  RequireConnected,
  RequireAnyBadge,
  ShowIfCapable,
  ShowIfBadge,
  CapabilityGate,
  BadgeGate,
  type RequireCapabilityProps,
  type RequireBadgeProps,
  type RequireConnectedProps,
  type RequireAnyBadgeProps,
  type ShowIfCapableProps,
  type ShowIfBadgeProps,
  type CapabilityGateProps,
  type BadgeGateProps,
} from "./guards";
