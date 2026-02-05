// TAGITPrograms ABI - Incentive programs and user reputation

export const ReputationTier = {
  BRONZE: 0,
  SILVER: 1,
  GOLD: 2,
  PLATINUM: 3,
} as const;

export type ReputationTierType =
  (typeof ReputationTier)[keyof typeof ReputationTier];

export const ReputationTierNames: Record<ReputationTierType, string> = {
  [ReputationTier.BRONZE]: "Bronze",
  [ReputationTier.SILVER]: "Silver",
  [ReputationTier.GOLD]: "Gold",
  [ReputationTier.PLATINUM]: "Platinum",
};

export const ReputationTierMultipliers: Record<ReputationTierType, number> = {
  [ReputationTier.BRONZE]: 1.0, // 1x rewards
  [ReputationTier.SILVER]: 1.25, // 1.25x rewards
  [ReputationTier.GOLD]: 1.5, // 1.5x rewards
  [ReputationTier.PLATINUM]: 2.0, // 2x rewards
};

export interface Program {
  id: `0x${string}`;
  rewardAmount: bigint;
  budget: bigint;
  spent: bigint;
  dailyCap: bigint;
  startsAt: bigint;
  endsAt: bigint;
  active: boolean;
}

export interface UserReputation {
  score: number;
  lastUpdated: number;
  slashedAt: number;
  slashPenalty: number;
  historyRoot: `0x${string}`;
}

export const TAGITProgramsABI = [
  // Program Management
  {
    inputs: [
      { type: "bytes32", name: "id" },
      { type: "uint256", name: "rewardAmount" },
      { type: "uint256", name: "budget" },
      { type: "uint256", name: "dailyCap" },
      { type: "uint48", name: "duration" },
    ],
    name: "createProgram",
    outputs: [{ type: "bool", name: "success" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { type: "bytes32", name: "id" },
      { type: "uint256", name: "newRewardAmount" },
      { type: "bool", name: "active" },
    ],
    name: "updateProgram",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { type: "bytes32", name: "id" },
      { type: "uint256", name: "amount" },
    ],
    name: "fundProgram",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // Rewards
  {
    inputs: [
      { type: "bytes32", name: "programId" },
      { type: "bytes32", name: "actionProof" },
    ],
    name: "claimReward",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // Reputation
  {
    inputs: [
      { type: "address", name: "user" },
      { type: "uint16", name: "newScore" },
      { type: "bytes32", name: "newHistoryRoot" },
    ],
    name: "updateReputation",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ type: "uint256", name: "amount" }],
    name: "stakeForReputation",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { type: "address", name: "user" },
      { type: "uint16", name: "penalty" },
      { type: "bytes32", name: "evidenceHash" },
    ],
    name: "slashReputation",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // View Functions
  {
    inputs: [{ type: "bytes32", name: "programId" }],
    name: "getProgram",
    outputs: [
      {
        type: "tuple",
        name: "program",
        components: [
          { type: "bytes32", name: "id" },
          { type: "uint256", name: "rewardAmount" },
          { type: "uint256", name: "budget" },
          { type: "uint256", name: "spent" },
          { type: "uint256", name: "dailyCap" },
          { type: "uint48", name: "startsAt" },
          { type: "uint48", name: "endsAt" },
          { type: "bool", name: "active" },
        ],
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ type: "address", name: "user" }],
    name: "getReputation",
    outputs: [
      {
        type: "tuple",
        name: "reputation",
        components: [
          { type: "uint16", name: "score" },
          { type: "uint32", name: "lastUpdated" },
          { type: "uint32", name: "slashedAt" },
          { type: "uint16", name: "slashPenalty" },
          { type: "bytes32", name: "historyRoot" },
        ],
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ type: "address", name: "user" }],
    name: "getWeightedScore",
    outputs: [{ type: "uint256", name: "weightedScore" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ type: "address", name: "user" }],
    name: "getReputationTier",
    outputs: [{ type: "uint8", name: "tier" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ type: "uint8", name: "tier" }],
    name: "getTierMultiplier",
    outputs: [{ type: "uint256", name: "multiplier" }],
    stateMutability: "pure",
    type: "function",
  },
  {
    inputs: [
      { type: "bytes32", name: "programId" },
      { type: "address", name: "user" },
    ],
    name: "getDailyClaims",
    outputs: [{ type: "uint256", name: "claims" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ type: "bytes32", name: "programId" }],
    name: "getRemainingBudget",
    outputs: [{ type: "uint256", name: "remaining" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "governor",
    outputs: [{ type: "address", name: "" }],
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
      { indexed: true, name: "programId", type: "bytes32" },
      { indexed: false, name: "rewardAmount", type: "uint256" },
      { indexed: false, name: "budget", type: "uint256" },
      { indexed: false, name: "dailyCap", type: "uint256" },
      { indexed: false, name: "startsAt", type: "uint48" },
      { indexed: false, name: "endsAt", type: "uint48" },
    ],
    name: "ProgramCreated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "programId", type: "bytes32" },
      { indexed: true, name: "user", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
      { indexed: false, name: "actionProof", type: "bytes32" },
    ],
    name: "RewardClaimed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "user", type: "address" },
      { indexed: false, name: "oldScore", type: "uint16" },
      { indexed: false, name: "newScore", type: "uint16" },
      { indexed: false, name: "historyRoot", type: "bytes32" },
    ],
    name: "ReputationUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "user", type: "address" },
      { indexed: false, name: "penalty", type: "uint16" },
      { indexed: false, name: "newScore", type: "uint16" },
      { indexed: false, name: "evidenceHash", type: "bytes32" },
    ],
    name: "ReputationSlashed",
    type: "event",
  },
] as const;
