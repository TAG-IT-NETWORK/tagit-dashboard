export const RequestStatus = {
  PENDING: 0,
  IN_PROGRESS: 1,
  VALIDATED: 2,
  REJECTED: 3,
  EXPIRED: 4,
} as const;

export type RequestStatusType = (typeof RequestStatus)[keyof typeof RequestStatus];

export const RequestStatusNames: Record<RequestStatusType, string> = {
  [RequestStatus.PENDING]: "Pending",
  [RequestStatus.IN_PROGRESS]: "In Progress",
  [RequestStatus.VALIDATED]: "Validated",
  [RequestStatus.REJECTED]: "Rejected",
  [RequestStatus.EXPIRED]: "Expired",
};

export interface ValidationRequest {
  agentId: bigint;
  requester: `0x${string}`;
  quorum: number;
  responseCount: number;
  createdAt: bigint;
  status: RequestStatusType;
  isDefense: boolean;
}

export interface ValidatorResponse {
  validator: `0x${string}`;
  score: number;
  justification: string;
  timestamp: bigint;
}

export interface ValidationSummary {
  totalRequests: bigint;
  passedCount: bigint;
  failedCount: bigint;
  latestScore: bigint;
  lastValidatedAt: bigint;
  isValidated: boolean;
}

export const TAGITAgentValidationABI = [
  // Read functions
  {
    name: "getRequest",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "requestId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "agentId", type: "uint256" },
          { name: "requester", type: "address" },
          { name: "quorum", type: "uint8" },
          { name: "responseCount", type: "uint8" },
          { name: "createdAt", type: "uint64" },
          { name: "status", type: "uint8" },
          { name: "isDefense", type: "bool" },
        ],
      },
    ],
  },
  {
    name: "getResponses",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "requestId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "validator", type: "address" },
          { name: "score", type: "uint8" },
          { name: "justification", type: "string" },
          { name: "timestamp", type: "uint64" },
        ],
      },
    ],
  },
  {
    name: "getSummary",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "totalRequests", type: "uint256" },
          { name: "passedCount", type: "uint256" },
          { name: "failedCount", type: "uint256" },
          { name: "latestScore", type: "uint256" },
          { name: "lastValidatedAt", type: "uint64" },
          { name: "isValidated", type: "bool" },
        ],
      },
    ],
  },
  {
    name: "getValidationStatus",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [
      { name: "isValidated", type: "bool" },
      { name: "latestScore", type: "uint256" },
      { name: "lastValidatedAt", type: "uint64" },
    ],
  },
  {
    name: "getAgentRequests",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    name: "getValidatorStats",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "validator", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "totalResponses", type: "uint256" },
          { name: "accurateResponses", type: "uint256" },
          { name: "lastResponseAt", type: "uint64" },
        ],
      },
    ],
  },
  {
    name: "hasValidatorResponded",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "requestId", type: "uint256" },
      { name: "validator", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  // Write functions
  {
    name: "validationRequest",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "isDefense", type: "bool" },
    ],
    outputs: [{ name: "requestId", type: "uint256" }],
  },
  {
    name: "validationResponse",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "requestId", type: "uint256" },
      { name: "score", type: "uint8" },
      { name: "justification", type: "string" },
    ],
    outputs: [],
  },
  // Events
  {
    name: "ValidationRequested",
    type: "event",
    inputs: [
      { name: "requestId", type: "uint256", indexed: true },
      { name: "agentId", type: "uint256", indexed: true },
      { name: "requester", type: "address", indexed: true },
      { name: "isDefense", type: "bool", indexed: false },
    ],
  },
  {
    name: "ValidationResponseSubmitted",
    type: "event",
    inputs: [
      { name: "requestId", type: "uint256", indexed: true },
      { name: "agentId", type: "uint256", indexed: true },
      { name: "validator", type: "address", indexed: true },
      { name: "score", type: "uint8", indexed: false },
    ],
  },
  {
    name: "ValidationFinalized",
    type: "event",
    inputs: [
      { name: "requestId", type: "uint256", indexed: true },
      { name: "agentId", type: "uint256", indexed: true },
      { name: "passed", type: "bool", indexed: false },
      { name: "finalScore", type: "uint256", indexed: false },
    ],
  },
] as const;
