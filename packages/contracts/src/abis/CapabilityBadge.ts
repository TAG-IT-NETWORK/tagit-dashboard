import { keccak256, toBytes } from "viem";

// Capability Badge IDs (ERC-1155 token IDs for capabilities)
export const CapabilityIds = {
  MINTER: 100,
  BINDER: 101,
  ACTIVATOR: 102,
  CLAIMER: 103,
  FLAGGER: 104,
  RESOLVER: 105,
  RECYCLER: 106,
} as const;

export type CapabilityId = (typeof CapabilityIds)[keyof typeof CapabilityIds];
export type CapabilityKey = keyof typeof CapabilityIds;

export const CapabilityIdNames: Record<CapabilityId, string> = {
  [CapabilityIds.MINTER]: "Minter",
  [CapabilityIds.BINDER]: "Binder",
  [CapabilityIds.ACTIVATOR]: "Activator",
  [CapabilityIds.CLAIMER]: "Claimer",
  [CapabilityIds.FLAGGER]: "Flagger",
  [CapabilityIds.RESOLVER]: "Resolver",
  [CapabilityIds.RECYCLER]: "Recycler",
};

// Mapping from capability key to bytes32 hash (for TAGITAccess compatibility)
export const CapabilityHashes = {
  MINTER: keccak256(toBytes("MINTER")),
  BINDER: keccak256(toBytes("BINDER")),
  ACTIVATOR: keccak256(toBytes("ACTIVATOR")),
  CLAIMER: keccak256(toBytes("CLAIMER")),
  FLAGGER: keccak256(toBytes("FLAGGER")),
  RESOLVER: keccak256(toBytes("RESOLVER")),
  RECYCLER: keccak256(toBytes("RECYCLER")),
} as const;

export type CapabilityHash = (typeof CapabilityHashes)[CapabilityKey];

// Mapping from bytes32 hash to numeric ID
export const HashToCapabilityId: Record<CapabilityHash, CapabilityId> = {
  [CapabilityHashes.MINTER]: CapabilityIds.MINTER,
  [CapabilityHashes.BINDER]: CapabilityIds.BINDER,
  [CapabilityHashes.ACTIVATOR]: CapabilityIds.ACTIVATOR,
  [CapabilityHashes.CLAIMER]: CapabilityIds.CLAIMER,
  [CapabilityHashes.FLAGGER]: CapabilityIds.FLAGGER,
  [CapabilityHashes.RESOLVER]: CapabilityIds.RESOLVER,
  [CapabilityHashes.RECYCLER]: CapabilityIds.RECYCLER,
};

// Mapping from numeric ID to bytes32 hash
export const CapabilityIdToHash: Record<CapabilityId, CapabilityHash> = {
  [CapabilityIds.MINTER]: CapabilityHashes.MINTER,
  [CapabilityIds.BINDER]: CapabilityHashes.BINDER,
  [CapabilityIds.ACTIVATOR]: CapabilityHashes.ACTIVATOR,
  [CapabilityIds.CLAIMER]: CapabilityHashes.CLAIMER,
  [CapabilityIds.FLAGGER]: CapabilityHashes.FLAGGER,
  [CapabilityIds.RESOLVER]: CapabilityHashes.RESOLVER,
  [CapabilityIds.RECYCLER]: CapabilityHashes.RECYCLER,
};

export const CapabilityIdList = Object.entries(CapabilityIds).map(([key, id]) => ({
  key: key as CapabilityKey,
  id: id as CapabilityId,
  name: CapabilityIdNames[id as CapabilityId],
  hash: CapabilityHashes[key as CapabilityKey],
}));

export const CapabilityBadgeABI = [
  // ERC-1155 base
  {
    inputs: [
      { type: "address", name: "account" },
      { type: "uint256", name: "id" },
    ],
    name: "balanceOf",
    outputs: [{ type: "uint256", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { type: "address[]", name: "accounts" },
      { type: "uint256[]", name: "ids" },
    ],
    name: "balanceOfBatch",
    outputs: [{ type: "uint256[]", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ type: "uint256", name: "id" }],
    name: "uri",
    outputs: [{ type: "string", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  // Capability Badge mint/burn (matching deployed contract)
  {
    inputs: [
      { type: "address", name: "to" },
      { type: "uint256", name: "id" },
      { type: "uint256", name: "amount" },
      { type: "bytes", name: "data" },
    ],
    name: "mint",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { type: "address", name: "from" },
      { type: "uint256", name: "id" },
      { type: "uint256", name: "amount" },
    ],
    name: "burn",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // Events
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
      { indexed: true, name: "operator", type: "address" },
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: false, name: "ids", type: "uint256[]" },
      { indexed: false, name: "values", type: "uint256[]" },
    ],
    name: "TransferBatch",
    type: "event",
  },
] as const;
