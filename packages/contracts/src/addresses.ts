export const CHAIN_ID = 11155420; // OP Sepolia

export const CONTRACTS = {
  TAGITCore: "0x6a58eE8f2d500981b1793868C55072789c58fba6",
  TAGITAccess: "0xf7efefc59E81540408b4c9c2a09417Ddb10b4936",
  IdentityBadge: "0xb3f757fca307a7febA5CA210Cd7D840EC0999be8",
  CapabilityBadge: "0xfa7E212efc6E9214c5dE5bd29C9f1e4ef089486",
} as const;

export type ContractName = keyof typeof CONTRACTS;
