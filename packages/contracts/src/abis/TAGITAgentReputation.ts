export interface Feedback {
  reviewer: `0x${string}`;
  agentId: bigint;
  rating: number;
  comment: string;
  response: string;
  timestamp: bigint;
  revoked: boolean;
}

export interface ReputationSummary {
  totalFeedback: bigint;
  activeFeedback: bigint;
  averageRating: bigint;
  weightedScore: bigint;
  lastFeedbackAt: bigint;
}

export const TAGITAgentReputationABI = [
  // Read functions
  {
    name: "getSummary",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [
      {
        name: "summary",
        type: "tuple",
        components: [
          { name: "totalFeedback", type: "uint256" },
          { name: "activeFeedback", type: "uint256" },
          { name: "averageRating", type: "uint256" },
          { name: "weightedScore", type: "uint256" },
          { name: "lastFeedbackAt", type: "uint64" },
        ],
      },
    ],
  },
  {
    name: "getFeedback",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "feedbackId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "reviewer", type: "address" },
          { name: "agentId", type: "uint256" },
          { name: "rating", type: "uint8" },
          { name: "comment", type: "string" },
          { name: "response", type: "string" },
          { name: "timestamp", type: "uint64" },
          { name: "revoked", type: "bool" },
        ],
      },
    ],
  },
  {
    name: "readAllFeedback",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "reviewer", type: "address" },
          { name: "agentId", type: "uint256" },
          { name: "rating", type: "uint8" },
          { name: "comment", type: "string" },
          { name: "response", type: "string" },
          { name: "timestamp", type: "uint64" },
          { name: "revoked", type: "bool" },
        ],
      },
    ],
  },
  {
    name: "getAgentFeedbackIds",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    name: "getReviewerFeedback",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "reviewer", type: "address" },
      { name: "agentId", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  // Write functions
  {
    name: "giveFeedback",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "rating", type: "uint8" },
      { name: "comment", type: "string" },
    ],
    outputs: [{ name: "feedbackId", type: "uint256" }],
  },
  {
    name: "revokeFeedback",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "feedbackId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "appendResponse",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "feedbackId", type: "uint256" },
      { name: "responseText", type: "string" },
    ],
    outputs: [],
  },
  // Events
  {
    name: "FeedbackGiven",
    type: "event",
    inputs: [
      { name: "feedbackId", type: "uint256", indexed: true },
      { name: "agentId", type: "uint256", indexed: true },
      { name: "reviewer", type: "address", indexed: true },
      { name: "rating", type: "uint8", indexed: false },
    ],
  },
  {
    name: "FeedbackRevoked",
    type: "event",
    inputs: [
      { name: "feedbackId", type: "uint256", indexed: true },
      { name: "agentId", type: "uint256", indexed: true },
    ],
  },
  {
    name: "ResponseAppended",
    type: "event",
    inputs: [
      { name: "feedbackId", type: "uint256", indexed: true },
      { name: "agentId", type: "uint256", indexed: true },
    ],
  },
] as const;
