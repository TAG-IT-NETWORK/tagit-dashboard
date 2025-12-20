// Types
export {
  IdentityBadgeType,
  IdentityBadgeTypeNames,
  Capability,
  CapabilityNames,
  BadgeCapabilities,
} from "./types";

// Hooks
export {
  useIdentityBadge,
  useCapabilities,
  useCanPerform,
  usePermissions,
} from "./hooks";

// Guards
export {
  RequireCapability,
  RequireBadge,
  RequireConnected,
  RequireAdmin,
  ShowIfCapable,
} from "./guards";
