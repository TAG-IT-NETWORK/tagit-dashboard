export const CHAIN_ID = 11155420; // OP Sepolia

// NIST CSF 2.0 Deployment - Jan 6, 2026
// All contracts include CircuitBreaker + RateLimiter compliance
export const CONTRACTS = {
  TAGITCore: "0x88D2b62FD388b2d7e3df5fc666D68Ac7c7ca02Fe" as `0x${string}`,
  TAGITAccess: "0x8611fE68f6E37238b0af84c5f2Ac2dc9012138a9" as `0x${string}`,
  IdentityBadge: "0x26F2E8b84664EF1ef8554e15777E8Ec6611256A6" as `0x${string}`,
  CapabilityBadge: "0x5e198f6Ebde4BD1e11a5566a1e81a933c40f3585" as `0x${string}`,
} as const;

// Start blocks for indexing
export const START_BLOCKS = {
  TAGITCore: 37959312,
  TAGITAccess: 37959312,
  IdentityBadge: 37959311,
  CapabilityBadge: 37959312,
} as const;

export type ContractName = keyof typeof CONTRACTS;
