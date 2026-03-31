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
  TAGITCore: "0x2cb1E0ecE274217F214057c0a829582834Aeaf7f" as `0x${string}`,
  TAGITAccess: "0x676f593c451E4dF2345026af891Acc92c4344455" as `0x${string}`,
  IdentityBadge: "0xEd6a36beB559A8047121B6300fF0060b0E64b5C7" as `0x${string}`,
  CapabilityBadge: "0xa8BbC7f95f5D979e8E9208bc627194384b257c24" as `0x${string}`,
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
// Base Sepolia addresses (deployed Mar 30, 2026)
// ──────────────────────────────────────────────

export const BASE_SEPOLIA_CHAIN_ID = 84532 as const;

const BASE_SEPOLIA_CONTRACTS = {
  TAGITCore: "0xAdBAc728205c91F2FfF3194Bf0cAf13457e32b68" as `0x${string}`,
  TAGITAccess: "0x0A729a8D75b896B30a34f96F2e6b7827523826D8" as `0x${string}`,
  IdentityBadge: "0xa8BbC7f95f5D979e8E9208bc627194384b257c24" as `0x${string}`,
  CapabilityBadge: "0x676f593c451E4dF2345026af891Acc92c4344455" as `0x${string}`,
  TAGITRecovery: "0x5bA8335Daa18A8C1e531f96BB498A2d817Feab85" as `0x${string}`,
  TAGITPaymaster: "0x065F3eD12D151DCE28E47964c19034b29DBb7ee2" as `0x${string}`,
  TAGITTreasury: "0xcA9c7FAD8c4FCFc342Ead99E1354633a9a8F8D42" as `0x${string}`,
  TAGITPrograms: "0xc359B42ebbEE5Ab1A6f733972A14e82342A0B53D" as `0x${string}`,
  TAGITStaking: "0x40629Cf37077105576d9C53fa909Fd199e0A1285" as `0x${string}`,
  TAGITAccount: "0xB3f757FCa307a7FebA5CA210Cd7D840EC69990e8" as `0x${string}`,
  TAGITAccountFactory: "0xf7eFefc59EB154040Db4C9c2aD9417Ddb10b4936" as `0x${string}`,
  CCIPAdapter: "0x62AFdac497F8b7e8D9365cd98C84c23592EA9471" as `0x${string}`,
} as const;

// ──────────────────────────────────────────────
// Chain-keyed lookup
// ──────────────────────────────────────────────

export type ContractAddresses = typeof OP_SEPOLIA_CONTRACTS;
export type ContractName = keyof ContractAddresses;

const addressesByChain: Record<number, ContractAddresses> = {
  [OP_SEPOLIA_CHAIN_ID]: OP_SEPOLIA_CONTRACTS,
  [ARBITRUM_SEPOLIA_CHAIN_ID]: ARBITRUM_SEPOLIA_CONTRACTS,
  [BASE_SEPOLIA_CHAIN_ID]: BASE_SEPOLIA_CONTRACTS,
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

// Arbitrum Sepolia start blocks — will be updated after deploy
export const ARBITRUM_START_BLOCKS = {
  TAGITCore: 246_901_619,
  TAGITAccess: 246_901_619,
  IdentityBadge: 246_901_619,
  CapabilityBadge: 246_901_619,
  TAGITPaymaster: 115_000_000, // deployed earlier
} as const;

// Base Sepolia start blocks — will be updated after deploy
export const BASE_SEPOLIA_START_BLOCKS = {
  TAGITCore: 0,
} as const;

/** Get start blocks for a given chain ID */
export const startBlocksByChain: Record<number, Record<string, number>> = {
  [OP_SEPOLIA_CHAIN_ID]: START_BLOCKS,
  [ARBITRUM_SEPOLIA_CHAIN_ID]: ARBITRUM_START_BLOCKS,
  [BASE_SEPOLIA_CHAIN_ID]: BASE_SEPOLIA_START_BLOCKS,
};
