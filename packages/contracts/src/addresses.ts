// Chain IDs defined locally to avoid cross-package type resolution issues
//
// Canonical chain = Base Sepolia (84532).
// Archived: OP Sepolia + Arbitrum Sepolia deployments deprecated 2026-06-27
// (history in tagit-contracts).

// ──────────────────────────────────────────────
// Archived chain IDs (deprecated — kept for historical reference only)
// ──────────────────────────────────────────────

/** @deprecated OP Sepolia archived 2026-06-27; use BASE_SEPOLIA_CHAIN_ID */
export const OP_SEPOLIA_CHAIN_ID = 11155420 as const;

/** @deprecated Arbitrum Sepolia archived 2026-06-27; use BASE_SEPOLIA_CHAIN_ID */
export const ARBITRUM_SEPOLIA_CHAIN_ID = 421614 as const;

// ──────────────────────────────────────────────
// Base Sepolia addresses (canonical — v2 redeployment Mar 31, 2026)
// ──────────────────────────────────────────────

export const BASE_SEPOLIA_CHAIN_ID = 84532 as const;

const BASE_SEPOLIA_CONTRACTS = {
  TAGITCore: "0x3aDc7EFDb58Ae85483eFf5D4966D916185f31d1D" as `0x${string}`,
  TAGITAccess: "0xb56A1D91995C212342FaA843468F03521340A1D6" as `0x${string}`,
  IdentityBadge: "0xebdAC9A0663c02a7297681b078aaD893EF345030" as `0x${string}`,
  CapabilityBadge: "0xb05d22706B08A3F6409601de520cf7A6dbCB573d" as `0x${string}`,
  TAGITRecovery: "0x6BC3C69367E586810A3B317fA9F0406504e95866" as `0x${string}`,
  TAGITPaymaster: "0x6fFFa92efb419E812d5c9C9D0c1B1a0f5c6fFd1C" as `0x${string}`,
  TAGITTreasury: "0xa4a3720d705334f409DD24836CC75d642125f759" as `0x${string}`,
  TAGITPrograms: "0x62a3CF048E66BE0119F0ccD97Ec964B726B9a982" as `0x${string}`,
  TAGITStaking: "0xB22F5688559D07e3a12DBB89f0481b967407F267" as `0x${string}`,
  TAGITAccount: "0x2160044C7c46B08a552361595E09e8C8DDD06E85" as `0x${string}`,
  TAGITAccountFactory: "0x3ed2c0E92F0e52dC68d04172aD37df4724893aD3" as `0x${string}`,
  CCIPAdapter: "0x5e190F6Ebde4BD1e11a5566a1e81a933cdDf3505" as `0x${string}`,
  TAGITToken: "0x5f98B83cD7Aef769cc51D2FB739BA49D561170DE" as `0x${string}`,
  TAGITGovernor: "0xCF67DF870EccBB7838c3ab7876467c89d84dce89" as `0x${string}`,
  TAGITEmissions: "0x0672fcC5b753786C2cD1805494fF094CB5d6E579" as `0x${string}`,
  TAGITBurner: "0xCB8AbCe0770C499B789481F8c6C20Fa0d6980d2a" as `0x${string}`,
  TAGITVesting: "0x7dd4c98a2aFE60eE06bA5c136dBeb7f93DD2699D" as `0x${string}`,
  IntegrationFactory: "0xd68919371c26700dDb8252aD1825Aa02a0381a86" as `0x${string}`,
  // VerificationEscrow — deployed & live on Base Sepolia (deploy block 39003336;
  // usdc()=Base USDC, trustedOracle()/owner()=0x458B4d0c…). Verified on-chain.
  VerificationEscrow: "0x4c9aACfcb64169E3BC187c227c4C0e0a5CFDA1cF" as `0x${string}`,
  // ReputationStaking — agent-bond contract (deploy block 43463277; minBond=100 TAGIT,
  // tagToken=TAGITToken, treasury=TAGITTreasury, agentIdentity=TAGITAccess). Basescan-verified.
  ReputationStaking: "0x4154af74DA2B3a98096317100296966Ade15574A" as `0x${string}`,
} as const;

// ──────────────────────────────────────────────
// Chain-keyed lookup
// ──────────────────────────────────────────────

export type ContractAddresses = typeof BASE_SEPOLIA_CONTRACTS;
export type ContractName = keyof ContractAddresses;

const addressesByChain: Record<number, ContractAddresses> = {
  [BASE_SEPOLIA_CHAIN_ID]: BASE_SEPOLIA_CONTRACTS,
};

/** Get contract addresses for a given chain ID (defaults to Base Sepolia) */
export function getContractsForChain(chainId: number): ContractAddresses {
  return addressesByChain[chainId] ?? BASE_SEPOLIA_CONTRACTS;
}

/** Get a specific contract address for a chain */
export function getContractAddress(chainId: number, name: ContractName): `0x${string}` {
  return getContractsForChain(chainId)[name];
}

// ──────────────────────────────────────────────
// Backwards-compatible exports (default to Base Sepolia)
// ──────────────────────────────────────────────

/** @deprecated Use getContractsForChain(chainId) instead */
export const CHAIN_ID = BASE_SEPOLIA_CHAIN_ID;

/** @deprecated Use getContractsForChain(chainId) instead */
export const CONTRACTS = BASE_SEPOLIA_CONTRACTS;

// Base Sepolia start blocks (deployment blocks)
export const BASE_SEPOLIA_START_BLOCKS = {
  TAGITCore: 39611546,
  VerificationEscrow: 39003336,
  ReputationStaking: 43463277,
} as const;

/** @deprecated Use startBlocksByChain[chainId] instead */
export const START_BLOCKS = BASE_SEPOLIA_START_BLOCKS;

/** Get start blocks for a given chain ID */
export const startBlocksByChain: Record<number, Record<string, number>> = {
  [BASE_SEPOLIA_CHAIN_ID]: BASE_SEPOLIA_START_BLOCKS,
};
