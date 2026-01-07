export const CHAIN_ID = 11155420; // OP Sepolia

// NIST CSF 2.0 Deployment - Jan 6, 2026
// All contracts include CircuitBreaker + RateLimiter compliance
export const CONTRACTS = {
  TAGITCore: "0x6fFFa92efb419E812d5c9C9D0c1B1a0f5c6fFd1C" as `0x${string}`,
  TAGITAccess: "0x4609a869a813E7E596bF5Bf5cBC08F8092Ce6340" as `0x${string}`,
  IdentityBadge: "0x26D0B3B5FF2061fB38ce1aA66433a8F4439e46a8" as `0x${string}`,
  CapabilityBadge: "0x62a3CF048E66BE0119F0ccD97Ec964B726B9a982" as `0x${string}`,
} as const;

// Start blocks for indexing
export const START_BLOCKS = {
  TAGITCore: 37959312,
  TAGITAccess: 37959312,
  IdentityBadge: 37959311,
  CapabilityBadge: 37959312,
} as const;

export type ContractName = keyof typeof CONTRACTS;
