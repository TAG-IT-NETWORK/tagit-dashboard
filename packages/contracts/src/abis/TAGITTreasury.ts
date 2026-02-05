// TAGITTreasury ABI - Protocol treasury with allocation tracking

export const WithdrawalStatus = {
  PENDING: 0,
  EXECUTED: 1,
  CANCELED: 2,
} as const;

export type WithdrawalStatusType =
  (typeof WithdrawalStatus)[keyof typeof WithdrawalStatus];

export const WithdrawalStatusNames: Record<WithdrawalStatusType, string> = {
  [WithdrawalStatus.PENDING]: "Pending",
  [WithdrawalStatus.EXECUTED]: "Executed",
  [WithdrawalStatus.CANCELED]: "Canceled",
};

export interface Allocation {
  programId: `0x${string}`;
  amount: bigint;
  spent: bigint;
  recipient: `0x${string}`;
  createdAt: bigint;
  expiresAt: bigint;
  active: boolean;
}

export interface PendingWithdrawal {
  allocationId: bigint;
  amount: bigint;
  token: `0x${string}`;
  to: `0x${string}`;
  queuedAt: bigint;
  executesAt: bigint;
  status: WithdrawalStatusType;
}

export const TAGITTreasuryABI = [
  // Deposit Functions
  {
    inputs: [],
    name: "deposit",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { type: "address", name: "token" },
      { type: "uint256", name: "amount" },
    ],
    name: "depositToken",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // Allocation Functions
  {
    inputs: [
      { type: "bytes32", name: "programId" },
      { type: "uint256", name: "amount" },
      { type: "address", name: "recipient" },
      { type: "uint48", name: "duration" },
    ],
    name: "createAllocation",
    outputs: [{ type: "uint256", name: "allocationId" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ type: "uint256", name: "allocationId" }],
    name: "closeAllocation",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // Withdrawal Functions
  {
    inputs: [
      { type: "uint256", name: "allocationId" },
      { type: "address", name: "token" },
      { type: "uint256", name: "amount" },
      { type: "address", name: "to" },
    ],
    name: "queueWithdrawal",
    outputs: [{ type: "uint256", name: "withdrawalId" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ type: "uint256", name: "withdrawalId" }],
    name: "executeWithdrawal",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ type: "uint256", name: "withdrawalId" }],
    name: "cancelWithdrawal",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // View Functions
  {
    inputs: [{ type: "uint256", name: "allocationId" }],
    name: "getAllocation",
    outputs: [
      {
        type: "tuple",
        name: "allocation",
        components: [
          { type: "bytes32", name: "programId" },
          { type: "uint256", name: "amount" },
          { type: "uint256", name: "spent" },
          { type: "address", name: "recipient" },
          { type: "uint48", name: "createdAt" },
          { type: "uint48", name: "expiresAt" },
          { type: "bool", name: "active" },
        ],
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ type: "uint256", name: "withdrawalId" }],
    name: "getWithdrawal",
    outputs: [
      {
        type: "tuple",
        name: "withdrawal",
        components: [
          { type: "uint256", name: "allocationId" },
          { type: "uint256", name: "amount" },
          { type: "address", name: "token" },
          { type: "address", name: "to" },
          { type: "uint48", name: "queuedAt" },
          { type: "uint48", name: "executesAt" },
          { type: "uint8", name: "status" },
        ],
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getBalance",
    outputs: [
      { type: "uint256", name: "eth" },
      { type: "uint256", name: "tagit" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalAllocated",
    outputs: [{ type: "uint256", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalUnallocated",
    outputs: [{ type: "uint256", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ type: "uint256", name: "allocationId" }],
    name: "remainingAllocation",
    outputs: [{ type: "uint256", name: "" }],
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
      { indexed: true, name: "from", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
    ],
    name: "ETHDeposited",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "allocationId", type: "uint256" },
      { indexed: true, name: "programId", type: "bytes32" },
      { indexed: true, name: "recipient", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
      { indexed: false, name: "expiresAt", type: "uint48" },
    ],
    name: "AllocationCreated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "withdrawalId", type: "uint256" },
      { indexed: true, name: "to", type: "address" },
      { indexed: false, name: "token", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
    ],
    name: "WithdrawalExecuted",
    type: "event",
  },
] as const;
