export const CHAIN_ID = 11155420; // OP Sepolia

export const CONTRACTS = {
  TAGITCore: {
    address: "0x6a58ee8f2d500981b1793868c55072789c58fba6" as const,
    abi: [
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
        inputs: [
          { type: "address", name: "to" },
          { type: "string", name: "metadataURI" },
        ],
        name: "mint",
        outputs: [{ type: "uint256", name: "" }],
        stateMutability: "nonpayable",
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
        name: "getState",
        outputs: [{ type: "uint8", name: "" }],
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
        anonymous: false,
        inputs: [
          { indexed: true, name: "from", type: "address" },
          { indexed: true, name: "to", type: "address" },
          { indexed: true, name: "tokenId", type: "uint256" },
        ],
        name: "Transfer",
        type: "event",
      },
    ],
  },
  CapabilityBadge: {
    address: "0xfa7E212efc6E9214c5dE5bd29C9f1e4ef089486" as const,
    abi: [
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
    ],
  },
} as const;

export const STATE_NAMES: Record<number, string> = {
  0: "MINTED",
  1: "REGISTERED",
  2: "VERIFIED",
  3: "SUSPENDED",
  4: "REVOKED",
};

export const BLOCKSCOUT_URL = "https://optimism-sepolia.blockscout.com";

export function getBlockscoutTxUrl(hash: string): string {
  return `${BLOCKSCOUT_URL}/tx/${hash}`;
}

export function getBlockscoutAddressUrl(address: string): string {
  return `${BLOCKSCOUT_URL}/address/${address}`;
}

export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function shortenHash(hash: string, chars = 6): string {
  return `${hash.slice(0, chars + 2)}...${hash.slice(-chars)}`;
}
