export const AgentStatus = {
  INACTIVE: 0,
  ACTIVE: 1,
  SUSPENDED: 2,
  DECOMMISSIONED: 3,
} as const;

export type AgentStatusType = (typeof AgentStatus)[keyof typeof AgentStatus];

export const AgentStatusNames: Record<AgentStatusType, string> = {
  [AgentStatus.INACTIVE]: "Inactive",
  [AgentStatus.ACTIVE]: "Active",
  [AgentStatus.SUSPENDED]: "Suspended",
  [AgentStatus.DECOMMISSIONED]: "Decommissioned",
};

export interface AgentIdentity {
  registrant: `0x${string}`;
  wallet: `0x${string}`;
  registeredAt: bigint;
  active: boolean;
}

export const TAGITAgentIdentityABI = [
  // Read functions
  {
    name: "totalAgents",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getAgent",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [
      { name: "registrant", type: "address" },
      { name: "wallet", type: "address" },
      { name: "registeredAt", type: "uint64" },
      { name: "active", type: "bool" },
    ],
  },
  {
    name: "getAgentStatus",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "tokenURI",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "getMetadata",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "key", type: "string" },
    ],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "getAgentByWallet",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getAgentsByRegistrant",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "registrant", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    name: "isActiveAgent",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "registrationFee",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "owner",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  // Write functions
  {
    name: "register",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "wallet", type: "address" },
      { name: "uri", type: "string" },
    ],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
  {
    name: "setAgentURI",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "newURI", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "setMetadata",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "key", type: "string" },
      { name: "value", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "suspendAgent",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "reactivateAgent",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "decommissionAgent",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [],
  },
  // Events
  {
    name: "AgentRegistered",
    type: "event",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "registrant", type: "address", indexed: true },
      { name: "wallet", type: "address", indexed: true },
      { name: "uri", type: "string", indexed: false },
    ],
  },
  {
    name: "AgentStatusChanged",
    type: "event",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "oldStatus", type: "uint8", indexed: false },
      { name: "newStatus", type: "uint8", indexed: false },
    ],
  },
  {
    name: "AgentMetadataSet",
    type: "event",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "key", type: "string", indexed: false },
      { name: "value", type: "string", indexed: false },
    ],
  },
] as const;
