/** Agent contract addresses by chain ID */
export interface AgentContractAddresses {
  TAGITAgentIdentity: `0x${string}`;
  TAGITAgentReputation: `0x${string}`;
  TAGITAgentValidation: `0x${string}`;
}

// Canonical chain = Base Sepolia (84532).
// Archived: OP Sepolia + Arbitrum Sepolia deployments deprecated 2026-06-27
// (history in tagit-contracts).
const agentContracts: Record<number, AgentContractAddresses> = {
  // Base Sepolia
  84532: {
    TAGITAgentIdentity: "0x0611FE60f6E37230bDaf04c5F2Ac2dc9012130a9",
    TAGITAgentReputation: "0x32be6C82A57d5bCe897538d7dA4109eA0eeB0aA1",
    TAGITAgentValidation: "0x34766dBa7040C2c8817f1Ee1e448209826DD607e",
  },
};

/** Look up agent contract addresses for a given chain ID */
export function getAgentContractsForChain(chainId: number): AgentContractAddresses {
  const addrs = agentContracts[chainId];
  if (!addrs) {
    throw new Error(`No agent contract addresses for chain ${chainId}`);
  }
  return addrs;
}
