import { keccak256, toBytes } from "viem";

// Capability constants as bytes32 hashes
export const Capabilities = {
  MINTER: keccak256(toBytes("MINTER")),
  BINDER: keccak256(toBytes("BINDER")),
  ACTIVATOR: keccak256(toBytes("ACTIVATOR")),
  CLAIMER: keccak256(toBytes("CLAIMER")),
  FLAGGER: keccak256(toBytes("FLAGGER")),
  RESOLVER: keccak256(toBytes("RESOLVER")),
  RECYCLER: keccak256(toBytes("RECYCLER")),
} as const;

export type CapabilityKey = keyof typeof Capabilities;
export type CapabilityHash = (typeof Capabilities)[CapabilityKey];

export const CapabilityNames: Record<CapabilityHash, string> = {
  [Capabilities.MINTER]: "Minter",
  [Capabilities.BINDER]: "Binder",
  [Capabilities.ACTIVATOR]: "Activator",
  [Capabilities.CLAIMER]: "Claimer",
  [Capabilities.FLAGGER]: "Flagger",
  [Capabilities.RESOLVER]: "Resolver",
  [Capabilities.RECYCLER]: "Recycler",
};

export const CapabilityList = Object.entries(Capabilities).map(([key, hash]) => ({
  key: key as CapabilityKey,
  hash,
  name: CapabilityNames[hash],
}));

export const TAGITAccessABI = [
  // Read functions
  {
    inputs: [
      { type: "address", name: "user" },
      { type: "bytes32", name: "capability" },
    ],
    name: "hasCapability",
    outputs: [{ type: "bool", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { type: "address", name: "user" },
      { type: "bytes32", name: "capability" },
    ],
    name: "requireCapability",
    outputs: [],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ type: "address", name: "user" }],
    name: "getCapabilities",
    outputs: [{ type: "bytes32[]", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  // Write functions
  {
    inputs: [
      { type: "address", name: "user" },
      { type: "bytes32", name: "capability" },
    ],
    name: "grantCapability",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { type: "address", name: "user" },
      { type: "bytes32", name: "capability" },
    ],
    name: "revokeCapability",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "user", type: "address" },
      { indexed: true, name: "capability", type: "bytes32" },
      { indexed: false, name: "granter", type: "address" },
    ],
    name: "CapabilityGranted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "user", type: "address" },
      { indexed: true, name: "capability", type: "bytes32" },
      { indexed: false, name: "revoker", type: "address" },
    ],
    name: "CapabilityRevoked",
    type: "event",
  },
] as const;
