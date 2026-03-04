// Chain IDs defined locally to avoid cross-package type resolution issues

// ──────────────────────────────────────────────
// OP Sepolia addresses (existing deployment)
// ──────────────────────────────────────────────

export const OP_SEPOLIA_CHAIN_ID = 11155420 as const;

const OP_SEPOLIA_CONTRACTS = {
  TAGITCore: "0x8bde22da889306d422802728cb98b6da42ed8e1a" as `0x${string}`,
  TAGITAccess: "0x0611FE60f6E37230bDaf04c5F2Ac2dc9012130a9" as `0x${string}`,
  IdentityBadge: "0x26F2EBb84664EF1eF8554e15777EBEc6611256A6" as `0x${string}`,
  CapabilityBadge: "0x5e190F6Ebde4BD1e11a5566a1e81a933cdDf3505" as `0x${string}`,
  TAGITRecovery: "0x6138a80c06A5e6a3CB6cc491A3a2c4DF4adD1600" as `0x${string}`,
  TAGITPaymaster: "0x4339c46D63231063250834D9b3fa4E51FdB8026e" as `0x${string}`,
  TAGITTreasury: "0xf6f5e2e03f6e28aE9Dc17bCc814a0cf758c887c9" as `0x${string}`,
  TAGITPrograms: "0xe78DB7702FF5190DAc2F3E09213Ff84bF9efE32b" as `0x${string}`,
  TAGITStaking: "0x12EE464e32a683f813fDb478e6C8e68E3d63d781" as `0x${string}`,
  TAGITAccount: "0xC159FDec7a8fDc0d98571C89c342e28bB405e682" as `0x${string}`,
  TAGITAccountFactory: "0x8D27B612a9D3e45d51D2234B2f4e03dCC5ca844b" as `0x${string}`,
  CCIPAdapter: "0x8dA6D7ffCD4cc0F2c9FfD6411CeD7C9c573C9E88" as `0x${string}`,
} as const;

// ──────────────────────────────────────────────
// Arbitrum Sepolia addresses (hackathon deployment)
// Placeholder until forge script broadcast
// ──────────────────────────────────────────────

export const ARBITRUM_SEPOLIA_CHAIN_ID = 421614 as const;

const ARBITRUM_SEPOLIA_CONTRACTS = {
  TAGITCore: "0x0000000000000000000000000000000000000000" as `0x${string}`, // TODO: update after deploy
  TAGITAccess: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  IdentityBadge: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  CapabilityBadge: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  TAGITRecovery: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  TAGITPaymaster: "0xBbB9f7dB1C38Af7998b511d8026042755Eb4F4C4" as `0x${string}`,
  TAGITTreasury: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  TAGITPrograms: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  TAGITStaking: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  TAGITAccount: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  TAGITAccountFactory: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  CCIPAdapter: "0x0000000000000000000000000000000000000000" as `0x${string}`,
} as const;

// ──────────────────────────────────────────────
// Chain-keyed lookup
// ──────────────────────────────────────────────

export type ContractAddresses = typeof OP_SEPOLIA_CONTRACTS;
export type ContractName = keyof ContractAddresses;

const addressesByChain: Record<number, ContractAddresses> = {
  [OP_SEPOLIA_CHAIN_ID]: OP_SEPOLIA_CONTRACTS,
  [ARBITRUM_SEPOLIA_CHAIN_ID]: ARBITRUM_SEPOLIA_CONTRACTS,
};

/** Get contract addresses for a given chain ID */
export function getContractsForChain(chainId: number): ContractAddresses {
  return addressesByChain[chainId] ?? OP_SEPOLIA_CONTRACTS;
}

/** Get a specific contract address for a chain */
export function getContractAddress(chainId: number, name: ContractName): `0x${string}` {
  return getContractsForChain(chainId)[name];
}

// ──────────────────────────────────────────────
// Backwards-compatible exports (default to OP Sepolia)
// ──────────────────────────────────────────────

/** @deprecated Use getContractsForChain(chainId) instead */
export const CHAIN_ID = OP_SEPOLIA_CHAIN_ID;

/** @deprecated Use getContractsForChain(chainId) instead */
export const CONTRACTS = OP_SEPOLIA_CONTRACTS;

export const START_BLOCKS = {
  TAGITCore: 40045836,
  TAGITAccess: 37959312,
  IdentityBadge: 37959311,
  CapabilityBadge: 37959312,
  TAGITRecovery: 37959312,
  TAGITPaymaster: 37959312,
  TAGITTreasury: 37959312,
  TAGITPrograms: 37959312,
  TAGITStaking: 37959312,
  TAGITAccount: 37959312,
  TAGITAccountFactory: 37959312,
  CCIPAdapter: 37959312,
} as const;
