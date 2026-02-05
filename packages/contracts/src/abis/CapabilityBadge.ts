import { keccak256, toBytes } from "viem";

// Capability names
export type CapabilityKey =
  | "MINTER"
  | "BINDER"
  | "ACTIVATOR"
  | "CLAIMER"
  | "FLAGGER"
  | "RESOLVER"
  | "RECYCLER";

// Capability hashes (keccak256) - these are what TAGITCore expects
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

// Convert hash to bigint for contract calls
export function capabilityHashToBigInt(hash: CapabilityHash): bigint {
  return BigInt(hash);
}

// Capability IDs as bigint (for contract calls) - TAGITCore expects these values
export const CapabilityIds = {
  MINTER: BigInt(CapabilityHashes.MINTER),
  BINDER: BigInt(CapabilityHashes.BINDER),
  ACTIVATOR: BigInt(CapabilityHashes.ACTIVATOR),
  CLAIMER: BigInt(CapabilityHashes.CLAIMER),
  FLAGGER: BigInt(CapabilityHashes.FLAGGER),
  RESOLVER: BigInt(CapabilityHashes.RESOLVER),
  RECYCLER: BigInt(CapabilityHashes.RECYCLER),
} as const;

export type CapabilityId = (typeof CapabilityIds)[CapabilityKey];

export const CapabilityIdNames: Record<CapabilityKey, string> = {
  MINTER: "Minter",
  BINDER: "Binder",
  ACTIVATOR: "Activator",
  CLAIMER: "Claimer",
  FLAGGER: "Flagger",
  RESOLVER: "Resolver",
  RECYCLER: "Recycler",
};

export const CapabilityIdList = (Object.keys(CapabilityHashes) as CapabilityKey[]).map((key) => ({
  key,
  id: CapabilityIds[key],
  hash: CapabilityHashes[key],
  name: CapabilityIdNames[key],
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
  // Capability Badge grant/revoke (owner only)
  {
    inputs: [
      { type: "address", name: "account" },
      { type: "uint256", name: "capabilityId" },
    ],
    name: "grantCapability",
    outputs: [{ type: "uint256", name: "amount" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { type: "address", name: "account" },
      { type: "uint256", name: "capabilityId" },
    ],
    name: "revokeCapability",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { type: "address", name: "account" },
      { type: "uint256", name: "capabilityId" },
    ],
    name: "hasCapability",
    outputs: [{ type: "bool", name: "" }],
    stateMutability: "view",
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
