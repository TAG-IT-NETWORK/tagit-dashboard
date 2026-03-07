export const TAGITCoreABI = [
  {
    type: "function",
    name: "getAsset",
    inputs: [{ type: "uint256", name: "tokenId" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "name", type: "string" },
          { name: "state", type: "uint8" },
          { name: "owner", type: "address" },
          { name: "mintedAt", type: "uint256" },
          { name: "lastUpdated", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
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
