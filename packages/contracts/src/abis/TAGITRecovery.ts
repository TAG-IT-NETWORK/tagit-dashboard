// TAGITRecovery ABI - AIRP (AI Recovery Protocol) dispute resolution

export const CaseStatus = {
  NONE: 0,
  PENDING: 1,
  VOTING: 2,
  RESOLVED: 3,
  REJECTED: 4,
  APPEALED: 5,
} as const;

export type CaseStatusType = (typeof CaseStatus)[keyof typeof CaseStatus];

export const CaseStatusNames: Record<CaseStatusType, string> = {
  [CaseStatus.NONE]: "None",
  [CaseStatus.PENDING]: "Pending",
  [CaseStatus.VOTING]: "Voting",
  [CaseStatus.RESOLVED]: "Resolved",
  [CaseStatus.REJECTED]: "Rejected",
  [CaseStatus.APPEALED]: "Appealed",
};

export interface RecoveryCase {
  tokenId: bigint;
  claimant: `0x${string}`;
  currentHolder: `0x${string}`;
  evidenceHash: `0x${string}`;
  createdAt: bigint;
  votingEndsAt: bigint;
  status: CaseStatusType;
  stakeBond: bigint;
  votesFor: bigint;
  votesAgainst: bigint;
  voteCount: bigint;
}

export interface Vote {
  approve: boolean;
  weight: bigint;
  reasonHash: `0x${string}`;
}

export const TAGITRecoveryABI = [
  // Core Functions
  {
    inputs: [
      { type: "uint256", name: "tokenId" },
      { type: "bytes32", name: "evidenceHash" },
    ],
    name: "initiateRecovery",
    outputs: [{ type: "uint256", name: "caseId" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { type: "uint256", name: "caseId" },
      { type: "bytes32", name: "evidenceHash" },
    ],
    name: "submitEvidence",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { type: "uint256", name: "caseId" },
      { type: "bool", name: "approve" },
      { type: "bytes32", name: "reasonHash" },
    ],
    name: "vote",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ type: "uint256", name: "caseId" }],
    name: "executeResolution",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { type: "uint256", name: "caseId" },
      { type: "bytes32", name: "newEvidenceHash" },
    ],
    name: "appeal",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // View Functions
  {
    inputs: [{ type: "uint256", name: "caseId" }],
    name: "getCase",
    outputs: [
      {
        type: "tuple",
        name: "",
        components: [
          { type: "uint256", name: "tokenId" },
          { type: "address", name: "claimant" },
          { type: "address", name: "currentHolder" },
          { type: "bytes32", name: "evidenceHash" },
          { type: "uint48", name: "createdAt" },
          { type: "uint48", name: "votingEndsAt" },
          { type: "uint8", name: "status" },
          { type: "uint256", name: "stakeBond" },
          { type: "uint256", name: "votesFor" },
          { type: "uint256", name: "votesAgainst" },
          { type: "uint256", name: "voteCount" },
        ],
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ type: "uint256", name: "tokenId" }],
    name: "isQuarantined",
    outputs: [{ type: "bool", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ type: "uint256", name: "tokenId" }],
    name: "getActiveCaseForToken",
    outputs: [{ type: "uint256", name: "caseId" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { type: "uint256", name: "caseId" },
      { type: "address", name: "voter" },
    ],
    name: "hasVoted",
    outputs: [{ type: "bool", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { type: "uint256", name: "caseId" },
      { type: "address", name: "voter" },
    ],
    name: "getVote",
    outputs: [
      {
        type: "tuple",
        name: "",
        components: [
          { type: "bool", name: "approve" },
          { type: "uint256", name: "weight" },
          { type: "bytes32", name: "reasonHash" },
        ],
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ type: "address", name: "voter" }],
    name: "getVoteWeight",
    outputs: [{ type: "uint256", name: "weight" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "version",
    outputs: [{ type: "string", name: "" }],
    stateMutability: "pure",
    type: "function",
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "caseId", type: "uint256" },
      { indexed: true, name: "tokenId", type: "uint256" },
      { indexed: true, name: "claimant", type: "address" },
      { indexed: false, name: "currentHolder", type: "address" },
      { indexed: false, name: "stakeBond", type: "uint256" },
      { indexed: false, name: "evidenceHash", type: "bytes32" },
    ],
    name: "RecoveryInitiated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "caseId", type: "uint256" },
      { indexed: true, name: "voter", type: "address" },
      { indexed: false, name: "approve", type: "bool" },
      { indexed: false, name: "weight", type: "uint256" },
      { indexed: false, name: "reasonHash", type: "bytes32" },
    ],
    name: "VoteCast",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "caseId", type: "uint256" },
      { indexed: false, name: "outcome", type: "uint8" },
      { indexed: false, name: "winner", type: "address" },
      { indexed: false, name: "votesFor", type: "uint256" },
      { indexed: false, name: "votesAgainst", type: "uint256" },
    ],
    name: "CaseResolved",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "tokenId", type: "uint256" },
      { indexed: true, name: "caseId", type: "uint256" },
    ],
    name: "AssetQuarantined",
    type: "event",
  },
] as const;
