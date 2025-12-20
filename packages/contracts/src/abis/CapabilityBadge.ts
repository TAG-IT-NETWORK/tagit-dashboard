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
  // Capability Badge specific
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
