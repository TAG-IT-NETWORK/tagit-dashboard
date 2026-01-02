// Badge ID constants (ERC-1155 token IDs)
export const BadgeIds = {
  // KYC Levels
  KYC_L1: 1,
  KYC_L2: 2,
  KYC_L3: 3,
  // Entity Types
  MANUFACTURER: 10,
  RETAILER: 11,
  // Government/Law Enforcement
  GOV_MIL: 20,
  LAW_ENFORCEMENT: 21,
} as const;

export type BadgeId = (typeof BadgeIds)[keyof typeof BadgeIds];

export const BadgeIdNames: Record<BadgeId, string> = {
  [BadgeIds.KYC_L1]: "KYC Level 1",
  [BadgeIds.KYC_L2]: "KYC Level 2",
  [BadgeIds.KYC_L3]: "KYC Level 3",
  [BadgeIds.MANUFACTURER]: "Manufacturer",
  [BadgeIds.RETAILER]: "Retailer",
  [BadgeIds.GOV_MIL]: "Government/Military",
  [BadgeIds.LAW_ENFORCEMENT]: "Law Enforcement",
};

export const BadgeIdList = Object.entries(BadgeIds).map(([key, id]) => ({
  key,
  id,
  name: BadgeIdNames[id as BadgeId],
}));

// Badge categories for grouping
export const BadgeCategories = {
  KYC: [BadgeIds.KYC_L1, BadgeIds.KYC_L2, BadgeIds.KYC_L3],
  ENTITY: [BadgeIds.MANUFACTURER, BadgeIds.RETAILER],
  AUTHORITY: [BadgeIds.GOV_MIL, BadgeIds.LAW_ENFORCEMENT],
} as const;

export const IdentityBadgeABI = [
  // ERC-1155 base functions
  {
    inputs: [
      { type: "address", name: "owner" },
      { type: "uint256", name: "badgeId" },
    ],
    name: "balanceOf",
    outputs: [{ type: "uint256", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { type: "address[]", name: "owners" },
      { type: "uint256[]", name: "badgeIds" },
    ],
    name: "balanceOfBatch",
    outputs: [{ type: "uint256[]", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ type: "uint256", name: "badgeId" }],
    name: "uri",
    outputs: [{ type: "string", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  // ERC-5192 Soulbound extension
  {
    inputs: [{ type: "uint256", name: "tokenId" }],
    name: "locked",
    outputs: [{ type: "bool", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  // Identity Badge specific
  {
    inputs: [{ type: "uint256", name: "badgeId" }],
    name: "getBadgeType",
    outputs: [{ type: "string", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ type: "address", name: "owner" }],
    name: "getBadges",
    outputs: [{ type: "uint256[]", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  // Admin functions
  {
    inputs: [
      { type: "address", name: "to" },
      { type: "uint256", name: "badgeId" },
    ],
    name: "grant",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { type: "address", name: "from" },
      { type: "uint256", name: "badgeId" },
    ],
    name: "revoke",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // Events
  {
    anonymous: false,
    inputs: [{ indexed: true, name: "tokenId", type: "uint256" }],
    name: "Locked",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [{ indexed: true, name: "tokenId", type: "uint256" }],
    name: "Unlocked",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "operator", type: "address" },
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: false, name: "id", type: "uint256" },
      { indexed: false, name: "value", type: "uint256" },
    ],
    name: "TransferSingle",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "to", type: "address" },
      { indexed: true, name: "badgeId", type: "uint256" },
      { indexed: false, name: "granter", type: "address" },
    ],
    name: "BadgeGranted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "badgeId", type: "uint256" },
      { indexed: false, name: "revoker", type: "address" },
    ],
    name: "BadgeRevoked",
    type: "event",
  },
] as const;
