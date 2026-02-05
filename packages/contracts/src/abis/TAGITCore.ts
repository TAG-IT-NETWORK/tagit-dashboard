// Asset lifecycle states
export const AssetState = {
  MINTED: 0,
  BOUND: 1,
  ACTIVATED: 2,
  CLAIMED: 3,
  FLAGGED: 4,
  RECYCLED: 5,
} as const;

export type AssetStateType = (typeof AssetState)[keyof typeof AssetState];

export const AssetStateNames: Record<AssetStateType, string> = {
  [AssetState.MINTED]: "Minted",
  [AssetState.BOUND]: "Bound",
  [AssetState.ACTIVATED]: "Activated",
  [AssetState.CLAIMED]: "Claimed",
  [AssetState.FLAGGED]: "Flagged",
  [AssetState.RECYCLED]: "Recycled",
};

// Resolution types for flagged assets
export const Resolution = {
  CLEAR: 0,
  QUARANTINE: 1,
  DECOMMISSION: 2,
} as const;

export type ResolutionType = (typeof Resolution)[keyof typeof Resolution];

export const ResolutionNames: Record<ResolutionType, string> = {
  [Resolution.CLEAR]: "Clear",
  [Resolution.QUARANTINE]: "Quarantine",
  [Resolution.DECOMMISSION]: "Decommission",
};

// Asset struct type
export interface Asset {
  id: bigint;
  owner: `0x${string}`;
  state: AssetStateType;
  tagId: `0x${string}`;
  metadataURI: string;
  createdAt: bigint;
  updatedAt: bigint;
}

export const TAGITCoreABI = [
  // Read functions
  {
    inputs: [],
    name: "name",
    outputs: [{ type: "string", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ type: "string", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalSupply",
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
  {
    inputs: [{ type: "uint256", name: "tokenId" }],
    name: "tokenURI",
    outputs: [{ type: "string", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ type: "uint256", name: "assetId" }],
    name: "getAsset",
    outputs: [
      {
        type: "tuple",
        name: "",
        components: [
          { type: "uint256", name: "id" },
          { type: "address", name: "owner" },
          { type: "uint8", name: "state" },
          { type: "bytes32", name: "tagId" },
          { type: "string", name: "metadataURI" },
          { type: "uint256", name: "createdAt" },
          { type: "uint256", name: "updatedAt" },
        ],
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ type: "uint256", name: "tokenId" }],
    name: "getState",
    outputs: [{ type: "uint8", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  // Write functions
  {
    inputs: [
      { type: "address", name: "to" },
      { type: "bytes32", name: "metadata" },
    ],
    name: "mint",
    outputs: [{ type: "uint256", name: "" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { type: "uint256", name: "assetId" },
      { type: "bytes32", name: "tagId" },
    ],
    name: "bindTag",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ type: "uint256", name: "assetId" }],
    name: "activate",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ type: "uint256", name: "assetId" }],
    name: "claim",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { type: "uint256", name: "assetId" },
      { type: "string", name: "reason" },
    ],
    name: "flag",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { type: "uint256", name: "assetId" },
      { type: "uint8", name: "resolution" },
    ],
    name: "resolve",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ type: "uint256", name: "assetId" }],
    name: "recycle",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: true, name: "tokenId", type: "uint256" },
    ],
    name: "Transfer",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "assetId", type: "uint256" },
      { indexed: false, name: "oldState", type: "uint8" },
      { indexed: false, name: "newState", type: "uint8" },
    ],
    name: "StateChanged",
    type: "event",
  },
] as const;
