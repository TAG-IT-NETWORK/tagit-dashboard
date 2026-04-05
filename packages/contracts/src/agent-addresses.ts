/** Agent contract addresses by chain ID */
export interface AgentContractAddresses {
  TAGITAgentIdentity: `0x${string}`;
  TAGITAgentReputation: `0x${string}`;
  TAGITAgentValidation: `0x${string}`;
}

const agentContracts: Record<number, AgentContractAddresses> = {
  // Base Sepolia
  84532: {
    TAGITAgentIdentity: "0x0611FE60f6E37230bDaf04c5F2Ac2dc9012130a9",
    TAGITAgentReputation: "0x32be6C82A57d5bCe897538d7dA4109eA0eeB0aA1",
    TAGITAgentValidation: "0x34766dBa7040C2c8817f1Ee1e448209826DD607e",
  },
  // OP Sepolia
  11155420: {
    TAGITAgentIdentity: "0xA7f34FD595eBc397Fe04DcE012dbcf0fbbD2A78D",
    TAGITAgentReputation: "0x57CCa1974DFE29593FBD24fdAEE1cD614Bfd6E4a",
    TAGITAgentValidation: "0x9806919185F98Bd07a64F7BC7F264e91939e86b7",
  },
  // Arbitrum Sepolia
  421614: {
    TAGITAgentIdentity: "0x5F5F71653d4929c6cD06EF8B16828b084BDf737c",
    TAGITAgentReputation: "0x6792EC172F57e124923FC10486cA47341F351D3c",
    TAGITAgentValidation: "0xbD7ac881567993DFBC56Bf7a7D76db083f04425c",
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
