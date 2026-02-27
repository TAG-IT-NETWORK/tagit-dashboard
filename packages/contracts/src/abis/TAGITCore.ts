// Asset lifecycle states (matches Solidity enum)
// Contract: State { NONE, MINTED, BOUND, ACTIVATED, CLAIMED, FLAGGED, RECYCLED }
export const AssetState = {
  NONE: 0,
  MINTED: 1,
  BOUND: 2,
  ACTIVATED: 3,
  CLAIMED: 4,
  FLAGGED: 5,
  RECYCLED: 6,
} as const;

export type AssetStateType = (typeof AssetState)[keyof typeof AssetState];

export const AssetStateNames: Record<AssetStateType, string> = {
  [AssetState.NONE]: "None",
  [AssetState.MINTED]: "Minted",
  [AssetState.BOUND]: "Bound",
  [AssetState.ACTIVATED]: "Activated",
  [AssetState.CLAIMED]: "Claimed",
  [AssetState.FLAGGED]: "Flagged",
  [AssetState.RECYCLED]: "Recycled",
};

// Asset struct type (matches contract getAsset return)
export interface Asset {
  owner: `0x${string}`;
  timestamp: bigint;
  state: AssetStateType;
  flags: number;
  reserved: number;
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
  // getAsset returns multiple values, not a tuple struct
  {
    inputs: [{ type: "uint256", name: "tokenId" }],
    name: "getAsset",
    outputs: [
      { type: "address", name: "assetOwner" },
      { type: "uint64", name: "timestamp" },
      { type: "uint8", name: "state" },
      { type: "uint8", name: "flags" },
      { type: "uint16", name: "reserved" },
    ],
    stateMutability: "view",
    type: "function",
  },
  // Tag lookup functions
  {
    inputs: [{ type: "bytes32", name: "tagHash" }],
    name: "getTokenByTag",
    outputs: [{ type: "uint256", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ type: "uint256", name: "tokenId" }],
    name: "getTagByToken",
    outputs: [{ type: "bytes32", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  // Access controller
  {
    inputs: [],
    name: "accessController",
    outputs: [{ type: "address", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  // Capability constants
  {
    inputs: [],
    name: "MINTER_CAPABILITY",
    outputs: [{ type: "bytes32", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "BINDER_CAPABILITY",
    outputs: [{ type: "bytes32", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "ACTIVATOR_CAPABILITY",
    outputs: [{ type: "bytes32", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "CLAIMER_CAPABILITY",
    outputs: [{ type: "bytes32", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "FLAGGER_CAPABILITY",
    outputs: [{ type: "bytes32", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "RESOLVER_CAPABILITY",
    outputs: [{ type: "bytes32", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "RECYCLER_CAPABILITY",
    outputs: [{ type: "bytes32", name: "" }],
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
    outputs: [{ type: "uint256", name: "tokenId" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { type: "uint256", name: "tokenId" },
      { type: "bytes32", name: "tagHash" },
      { type: "bytes", name: "challengeResponse" },
      { type: "bytes", name: "oracleSignature" },
    ],
    name: "bindTag",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ type: "uint256", name: "tokenId" }],
    name: "activate",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { type: "uint256", name: "tokenId" },
      { type: "address", name: "newOwner" },
    ],
    name: "claim",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ type: "uint256", name: "tokenId" }],
    name: "flag",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { type: "uint256", name: "tokenId" },
      { type: "address", name: "newOwner" },
    ],
    name: "approveResolve",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { type: "uint256", name: "tokenId" },
      { type: "address", name: "newOwner" },
    ],
    name: "resolve",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ type: "uint256", name: "tokenId" }],
    name: "recycle",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // Admin functions
  {
    inputs: [{ type: "address", name: "controller" }],
    name: "setAccessController",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // UUPS Proxy — initialize (replaces constructor)
  {
    inputs: [{ type: "address", name: "initialOwner" }],
    name: "initialize",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // UUPS Proxy — upgrade authorization
  {
    inputs: [],
    name: "proxiableUUID",
    outputs: [{ type: "bytes32", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { type: "address", name: "newImplementation" },
      { type: "bytes", name: "data" },
    ],
    name: "upgradeToAndCall",
    outputs: [],
    stateMutability: "payable",
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
      { indexed: true, name: "tokenId", type: "uint256" },
      { indexed: true, name: "to", type: "address" },
      { indexed: false, name: "metadata", type: "bytes32" },
    ],
    name: "AssetMinted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "tokenId", type: "uint256" },
      { indexed: false, name: "from", type: "uint8" },
      { indexed: false, name: "to", type: "uint8" },
      { indexed: false, name: "actor", type: "address" },
    ],
    name: "StateChanged",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "tokenId", type: "uint256" },
      { indexed: true, name: "tagHash", type: "bytes32" },
    ],
    name: "TagBound",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "previousController", type: "address" },
      { indexed: true, name: "newController", type: "address" },
    ],
    name: "AccessControllerUpdated",
    type: "event",
  },
  // UUPS Proxy events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "implementation", type: "address" },
    ],
    name: "Upgraded",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [{ indexed: false, name: "version", type: "uint64" }],
    name: "Initialized",
    type: "event",
  },
  // Errors
  {
    inputs: [{ type: "uint256", name: "tokenId" }],
    name: "TokenNotFound",
    type: "error",
  },
  {
    inputs: [
      { type: "uint256", name: "tokenId" },
      { type: "uint8", name: "current" },
      { type: "uint8", name: "required" },
    ],
    name: "InvalidState",
    type: "error",
  },
  {
    inputs: [{ type: "bytes32", name: "tagHash" }],
    name: "TagAlreadyBound",
    type: "error",
  },
  {
    inputs: [
      { type: "address", name: "caller" },
      { type: "uint256", name: "requiredCapability" },
    ],
    name: "Unauthorized",
    type: "error",
  },
  {
    inputs: [],
    name: "ZeroAddress",
    type: "error",
  },
  {
    inputs: [
      { type: "uint8", name: "from" },
      { type: "uint8", name: "to" },
    ],
    name: "InvalidTransition",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidTokenId",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidTagHash",
    type: "error",
  },
  {
    inputs: [],
    name: "OracleNotSet",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidOracleSignature",
    type: "error",
  },
] as const;
