export const TAGITCoreABI = [
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
  {
    inputs: [{ type: "uint256", name: "tokenId" }],
    name: "ownerOf",
    outputs: [{ type: "address", name: "" }],
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
] as const;
