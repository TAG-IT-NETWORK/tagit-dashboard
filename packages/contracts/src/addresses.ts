export const CHAIN_ID = 11155420 as const; // OP Sepolia

// NIST CSF 2.0 Deployment - Jan 6, 2026
// All contracts include CircuitBreaker + RateLimiter compliance
export const CONTRACTS = {
  // Core Contracts (Phase 1)
  TAGITCore: "0x8B02b62FD388b2d7e3dF5Ec666D68Ac7c7ca02Fe" as `0x${string}`,
  TAGITAccess: "0x0611FE60f6E37230bDaf04c5F2Ac2dc9012130a9" as `0x${string}`,
  IdentityBadge: "0x26F2EBb84664EF1eF8554e15777EBEc6611256A6" as `0x${string}`,
  CapabilityBadge: "0x5e190F6Ebde4BD1e11a5566a1e81a933cdDf3505" as `0x${string}`,

  // NIST Phase 3 Contracts
  TAGITRecovery: "0x6138a80c06A5e6a3CB6cc491A3a2c4DF4adD1600" as `0x${string}`,
  TAGITPaymaster: "0x4339c46D63231063250834D9b3fa4E51FdB8026e" as `0x${string}`,
  TAGITTreasury: "0xf6f5e2e03f6e28aE9Dc17bCc814a0cf758c887c9" as `0x${string}`,
  TAGITPrograms: "0xe78DB7702FF5190DAc2F3E09213Ff84bF9efE32b" as `0x${string}`,
  TAGITStaking: "0x12EE464e32a683f813fDb478e6C8e68E3d63d781" as `0x${string}`,

  // Account Abstraction (ERC-4337)
  TAGITAccount: "0xC159FDec7a8fDc0d98571C89c342e28bB405e682" as `0x${string}`,
  TAGITAccountFactory: "0x8D27B612a9D3e45d51D2234B2f4e03dCC5ca844b" as `0x${string}`,

  // Cross-Chain (CCIP)
  CCIPAdapter: "0x8dA6D7ffCD4cc0F2c9FfD6411CeD7C9c573C9E88" as `0x${string}`,
} as const;

// Start blocks for indexing
export const START_BLOCKS = {
  TAGITCore: 37959312,
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

export type ContractName = keyof typeof CONTRACTS;
