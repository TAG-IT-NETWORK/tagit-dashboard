export const IdentityBadgeABI = [
  // ERC-721 base
  {
    inputs: [{ type: "address", name: "owner" }],
    name: "balanceOf",
    outputs: [{ type: "uint256", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ type: "uint256", name: "tokenId" }],
    name: "ownerOf",
    outputs: [{ type: "address", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  // ERC-5192 Soulbound
  {
    inputs: [{ type: "uint256", name: "tokenId" }],
    name: "locked",
    outputs: [{ type: "bool", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  // Identity Badge specific
  {
    inputs: [{ type: "address", name: "account" }],
    name: "getBadgeType",
    outputs: [{ type: "uint8", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ type: "address", name: "account" }],
    name: "hasBadge",
    outputs: [{ type: "bool", name: "" }],
    stateMutability: "view",
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
] as const;
