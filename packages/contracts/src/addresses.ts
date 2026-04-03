// Chain IDs defined locally to avoid cross-package type resolution issues

// ──────────────────────────────────────────────
// OP Sepolia addresses (updated Apr 2, 2026)
// ──────────────────────────────────────────────

export const OP_SEPOLIA_CHAIN_ID = 11155420 as const;

const OP_SEPOLIA_CONTRACTS = {
  TAGITCore: "0x8BdE22da889306d422802728cb98B6Da42ed8e1a" as `0x${string}`,
  TAGITAccess: "0x0611FE60f6E37230bDaf04c5F2Ac2dc9012130a9" as `0x${string}`,
  IdentityBadge: "0x26F2EBb84664EF1eF8554e15777EBEc6611256A6" as `0x${string}`,
  CapabilityBadge: "0x5e190F6Ebde4BD1e11a5566a1e81a933cdDf3505" as `0x${string}`,
  TAGITRecovery: "0x17c0af6B37aBD06587303f1695a06A668F8A5A8c" as `0x${string}`,
  TAGITPaymaster: "0x670DC1C7821E0A717CFf5Cc949B05EC01b532104" as `0x${string}`,
  TAGITTreasury: "0x841B07Ad929CCC589446e29Aa0C4Dd1639B48674" as `0x${string}`,
  TAGITPrograms: "0x4d1007eB4823a5a13905A0361478C339421ce4C9" as `0x${string}`,
  TAGITStaking: "0xe500CDfbA693CE1f39A6F05CfB4614971370Ee93" as `0x${string}`,
  TAGITAccount: "0xC159FDec7a8fDc0d98571C89c342e28bB405e682" as `0x${string}`,
  TAGITAccountFactory: "0x0ECe601E24789409C87010E064F88d584b051d68" as `0x${string}`,
  CCIPAdapter: "0x76C375716bE762EEcb4860D06bB051735e6fb3FA" as `0x${string}`,
  TAGITToken: "0x061a89736F91cAC11272B8A95fc7e377cD0e4067" as `0x${string}`,
  TAGITGovernor: "0x8A7cd4FC493663Fc5CD0268704969D644BA773e3" as `0x${string}`,
  TAGITEmissions: "0x0259822faf08597f5B9D399F59332d136c6D518d" as `0x${string}`,
  TAGITBurner: "0xBAa0346AD5ED79Ec280cb0951C5Ea80A35D985A9" as `0x${string}`,
  TAGITVesting: "0x4052d29e2aB49193F0577934963b9650F633e63F" as `0x${string}`,
  IntegrationFactory: "0xac3687df5A09a5FeD697eb40B6dB22a98cC7B0a8" as `0x${string}`,
  VerificationEscrow: "0x698D4DbaE56BC7e36E2Ab34bd47aB97461219726" as `0x${string}`,
} as const;

// ──────────────────────────────────────────────
// Arbitrum Sepolia addresses (full redeployment Apr 2, 2026)
// ──────────────────────────────────────────────

export const ARBITRUM_SEPOLIA_CHAIN_ID = 421614 as const;

const ARBITRUM_SEPOLIA_CONTRACTS = {
  TAGITCore: "0x5952f5af2429e6f973FE40aD6bEad5c770837233" as `0x${string}`,
  TAGITAccess: "0x801c45774fC70DC6ADe30CC0a2F524CadadCDdC7" as `0x${string}`,
  IdentityBadge: "0x76965313aF612bac577E137D8190fB1E3523a307" as `0x${string}`,
  CapabilityBadge: "0xB639d0B53338F83c25883271ea4c1aDc60F14f7A" as `0x${string}`,
  TAGITRecovery: "0xfFdDB206e8F0027EC598EDA8b0CdFf528f9a3A7F" as `0x${string}`,
  TAGITPaymaster: "0x533830101306d69D70b830ABdeE954774c561c32" as `0x${string}`,
  TAGITTreasury: "0x79af1F94Bbe40Ad8A52774fFD69626EE48701d48" as `0x${string}`,
  TAGITPrograms: "0xe798CD1CD53DdD27D07b1ea084c0D379A5Bc400c" as `0x${string}`,
  TAGITStaking: "0xc7fB8B6A838449a19d138601cF1711C5f36Fd655" as `0x${string}`,
  TAGITAccount: "0xa97fBBD5aB97a0d8067E3dD1A51d2b0b88e14ac2" as `0x${string}`,
  TAGITAccountFactory: "0xBC68ff3E74020c78e8A69cD553503A9aF93bBDC1" as `0x${string}`,
  CCIPAdapter: "0x8b1b3C5946a62C4ba35B25621e74d49a41D40BC5" as `0x${string}`,
  TAGITToken: "0x42456C31b336D866DE9EB56f9916Af0A97Ae14f6" as `0x${string}`,
  TAGITGovernor: "0xad0b3009b5C57D3034bB4b8eBaCb1028D6891c06" as `0x${string}`,
  TAGITEmissions: "0xa6203965F164aDbE954041C912F517CAeDD90aA0" as `0x${string}`,
  TAGITBurner: "0xca85E7B6CcE9907DEd1A6b2b6DC98Fba5FE7E8C5" as `0x${string}`,
  TAGITVesting: "0xE4C87C0acDbd73789Ea16fE1f6D712050C0bFd13" as `0x${string}`,
  IntegrationFactory: "0x7580f30625730C8Ad1086bC36eeB1258472430EA" as `0x${string}`,
  VerificationEscrow: "0xF78C7d5bdED8eA0B159b0223a631679E91508C04" as `0x${string}`,
} as const;

// ──────────────────────────────────────────────
// Base Sepolia addresses (v2 redeployment Mar 31, 2026)
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
  VerificationEscrow: "0x4c9aACfcb64169E3BC187c227c4C0e0a5CFDA1cF" as `0x${string}`,
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

// Arbitrum Sepolia start blocks (redeployed Apr 2, 2026)
export const ARBITRUM_START_BLOCKS = {
  TAGITCore: 246_901_619,
  TAGITAccess: 246_901_619,
  IdentityBadge: 246_901_619,
  CapabilityBadge: 246_901_619,
  TAGITPaymaster: 246_901_619,
} as const;

// Base Sepolia start blocks
export const BASE_SEPOLIA_START_BLOCKS = {
  TAGITCore: 0,
} as const;

/** Get start blocks for a given chain ID */
export const startBlocksByChain: Record<number, Record<string, number>> = {
  [OP_SEPOLIA_CHAIN_ID]: START_BLOCKS,
  [ARBITRUM_SEPOLIA_CHAIN_ID]: ARBITRUM_START_BLOCKS,
  [BASE_SEPOLIA_CHAIN_ID]: BASE_SEPOLIA_START_BLOCKS,
};
