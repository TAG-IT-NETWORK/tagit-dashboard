export const CHAIN_ID = 11155420; // OP Sepolia

// All lowercase addresses are valid (bypass checksum validation)
export const CONTRACTS = {
  TAGITCore: "0x6a58ee8f2d500981b1793868c55072789c58fba6" as `0x${string}`,
  TAGITAccess: "0xf7efefc59e81540408b4c9c2a09417ddb10b4936" as `0x${string}`,
  IdentityBadge: "0xb3f757fca307a7feba5ca210cd7d840ec0999be8" as `0x${string}`,
  CapabilityBadge: "0xfa7e212efc6e9214c5de5bd29c9f1e4ef0894860" as `0x${string}`,
} as const;

export type ContractName = keyof typeof CONTRACTS;
