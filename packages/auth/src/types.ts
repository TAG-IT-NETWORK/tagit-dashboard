export enum IdentityBadgeType {
  NONE = 0,
  ADMIN = 1,
  GOV_MIL = 2,
  MANUFACTURER = 3,
  RETAILER = 4,
  RECYCLER = 5,
}

export const IdentityBadgeTypeNames: Record<IdentityBadgeType, string> = {
  [IdentityBadgeType.NONE]: "None",
  [IdentityBadgeType.ADMIN]: "Admin",
  [IdentityBadgeType.GOV_MIL]: "Government/Military",
  [IdentityBadgeType.MANUFACTURER]: "Manufacturer",
  [IdentityBadgeType.RETAILER]: "Retailer",
  [IdentityBadgeType.RECYCLER]: "Recycler",
};

export enum Capability {
  MINT = 1,
  BIND = 2,
  ACTIVATE = 3,
  CLAIM = 4,
  FLAG = 5,
  RESOLVE = 6,
  RECYCLE = 7,
}

export const CapabilityNames: Record<Capability, string> = {
  [Capability.MINT]: "Mint",
  [Capability.BIND]: "Bind",
  [Capability.ACTIVATE]: "Activate",
  [Capability.CLAIM]: "Claim",
  [Capability.FLAG]: "Flag",
  [Capability.RESOLVE]: "Resolve",
  [Capability.RECYCLE]: "Recycle",
};

// Capabilities granted by each identity badge type
export const BadgeCapabilities: Record<IdentityBadgeType, Capability[]> = {
  [IdentityBadgeType.NONE]: [Capability.CLAIM, Capability.FLAG],
  [IdentityBadgeType.ADMIN]: [
    Capability.MINT,
    Capability.BIND,
    Capability.ACTIVATE,
    Capability.CLAIM,
    Capability.FLAG,
    Capability.RESOLVE,
    Capability.RECYCLE,
  ],
  [IdentityBadgeType.GOV_MIL]: [
    Capability.MINT,
    Capability.BIND,
    Capability.ACTIVATE,
    Capability.CLAIM,
    Capability.FLAG,
    Capability.RESOLVE,
    Capability.RECYCLE,
  ],
  [IdentityBadgeType.MANUFACTURER]: [Capability.MINT, Capability.BIND],
  [IdentityBadgeType.RETAILER]: [Capability.ACTIVATE],
  [IdentityBadgeType.RECYCLER]: [Capability.RECYCLE],
};
