export const CHAIN_ID = 11155420 as const; // OP Sepolia

// NIST CSF 2.0 Deployment - Jan 6, 2026
// All contracts include CircuitBreaker + RateLimiter compliance
export const CONTRACTS = {
  TAGITCore: "0x8B02b62FD388b2d7e3dF5Ec666D68Ac7c7ca02Fe" as `0x${string}`,
  TAGITAccess: "0x0611FE60f6E37230bDaf04c5F2Ac2dc9012130a9" as `0x${string}`,
  IdentityBadge: "0x26F2EBb84664EF1eF8554e15777EBEc6611256A6" as `0x${string}`,
  CapabilityBadge: "0x5e190F6Ebde4BD1e11a5566a1e81a933cdDf3505" as `0x${string}`,
} as const;

// Start blocks for indexing
export const START_BLOCKS = {
  TAGITCore: 37959312,
  TAGITAccess: 37959312,
  IdentityBadge: 37959311,
  CapabilityBadge: 37959312,
} as const;

export type ContractName = keyof typeof CONTRACTS;
