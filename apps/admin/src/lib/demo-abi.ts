export const TAGITCoreDemoABI = [
  {
    type: "constructor",
    inputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "admin",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "changeState",
    inputs: [
      { name: "tokenId", type: "uint256", internalType: "uint256" },
      { name: "newState", type: "uint8", internalType: "enum TAGITCoreDemo.State" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getAsset",
    inputs: [{ name: "tokenId", type: "uint256", internalType: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct TAGITCoreDemo.Asset",
        components: [
          { name: "name", type: "string", internalType: "string" },
          { name: "state", type: "uint8", internalType: "enum TAGITCoreDemo.State" },
          { name: "owner", type: "address", internalType: "address" },
          { name: "mintedAt", type: "uint256", internalType: "uint256" },
          { name: "lastUpdated", type: "uint256", internalType: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getTokenIds",
    inputs: [],
    outputs: [{ name: "", type: "uint256[]", internalType: "uint256[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "mint",
    inputs: [
      { name: "tokenId", type: "uint256", internalType: "uint256" },
      { name: "name", type: "string", internalType: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "totalAssets",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "AssetMinted",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "name", type: "string", indexed: false, internalType: "string" },
      { name: "owner", type: "address", indexed: false, internalType: "address" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "StateChanged",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "oldState", type: "uint8", indexed: false, internalType: "enum TAGITCoreDemo.State" },
      { name: "newState", type: "uint8", indexed: false, internalType: "enum TAGITCoreDemo.State" },
      { name: "changedBy", type: "address", indexed: false, internalType: "address" },
    ],
    anonymous: false,
  },
  { type: "error", name: "AlreadyExists", inputs: [] },
  { type: "error", name: "DoesNotExist", inputs: [] },
  { type: "error", name: "NotAdmin", inputs: [] },
] as const;

export const DEMO_CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_TAGIT_CORE_ADDRESS ||
  "0x62A81066Cc868cDe6115b87F1d585c891BFfCcC3") as `0x${string}`;

export const STATE_LABELS: Record<number, string> = {
  0: "NONE",
  1: "MINTED",
  2: "BOUND",
  3: "ACTIVATED",
  4: "CLAIMED",
  5: "FLAGGED",
  6: "RECYCLED",
};

export const STATE_COLORS: Record<number, string> = {
  0: "bg-gray-500/10 text-gray-400 border-gray-500/30",
  1: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  2: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  3: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  4: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  5: "bg-red-500/10 text-red-400 border-red-500/30",
  6: "bg-gray-500/10 text-gray-500 border-gray-500/30",
};

export const NEXT_STATE: Record<number, { label: string; value: number }> = {
  1: { label: "Bind", value: 2 },
  2: { label: "Activate", value: 3 },
  3: { label: "Claim", value: 4 },
  4: { label: "Flag", value: 5 },
  5: { label: "Recycle", value: 6 },
};
