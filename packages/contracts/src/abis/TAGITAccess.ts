export const TAGITAccessABI = [
  {
    inputs: [
      { type: "address", name: "account" },
      { type: "uint256", name: "capability" },
    ],
    name: "hasCapability",
    outputs: [{ type: "bool", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { type: "address", name: "account" },
      { type: "uint256", name: "capability" },
    ],
    name: "requireCapability",
    outputs: [],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ type: "address", name: "account" }],
    name: "getCapabilities",
    outputs: [{ type: "uint256[]", name: "" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
