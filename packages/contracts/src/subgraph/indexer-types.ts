// TypeScript interfaces for tagit-indexer GraphQL schema
// Maps to entities defined in tagit-indexer/schema.graphql

// ─── Agent Activity Types ───────────────────────────────────────────────

export interface IndexerAgent {
  id: string;
  agentId: string; // BigInt as string
  registrant: string; // Bytes (hex address)
  wallet: string; // Bytes (hex address)
  uri: string;
  status: number;
  statusLabel: string;
  registeredAt: string; // BigInt as string
  registeredAtBlock: string; // BigInt as string
  feedbackCount: number;
  activeFeedbackCount: number;
  ratingSum: number;
  averageRating: string; // BigDecimal as string
  validationRequestCount: number;
  validationPassedCount: number;
  validationFailedCount: number;
  isValidated: boolean;
}

export interface IndexerAgentStatusChange {
  id: string;
  agent: { id: string; agentId: string; wallet: string; statusLabel: string };
  oldStatus: number;
  newStatus: number;
  oldStatusLabel: string;
  newStatusLabel: string;
  timestamp: string; // BigInt as string
  blockNumber: string; // BigInt as string
  transactionHash: string; // Bytes
}

export interface IndexerFeedback {
  id: string;
  feedbackId: string; // BigInt as string
  agent: { id: string; agentId: string; wallet: string };
  reviewer: string; // Bytes (hex address)
  rating: number;
  revoked: boolean;
  hasResponse: boolean;
  createdAt: string; // BigInt as string
  createdAtBlock: string; // BigInt as string
}

export interface IndexerValidationRequest {
  id: string;
  requestId: string; // BigInt as string
  agent: { id: string; agentId: string; wallet: string };
  requester: string; // Bytes (hex address)
  isDefense: boolean;
  status: string;
  responseCount: number;
  passed: boolean;
  finalScore: string; // BigInt as string
  createdAt: string; // BigInt as string
  createdAtBlock: string; // BigInt as string
  finalizedAt: string | null; // BigInt as string
}

export interface IndexerRewardDistribution {
  id: string;
  recipientAddress: string; // Bytes (hex address)
  amount: string; // BigInt as string
  triggerType: number;
  triggerTypeLabel: string;
  cumulativeDistributed: string; // BigInt as string
  blockNumber: string; // BigInt as string
  timestamp: string; // BigInt as string
  transactionHash: string; // Bytes
}

// ─── wTAG Token Types ───────────────────────────────────────────────────

export interface IndexerWTagAccount {
  id: string;
  address: string; // Bytes (hex address)
  balance: string; // BigInt as string
  transfersSent: number;
  transfersReceived: number;
}

export interface IndexerWTagTransfer {
  id: string;
  from: { id: string; address: string };
  to: { id: string; address: string };
  value: string; // BigInt as string
  timestamp: string; // BigInt as string
  blockNumber: string; // BigInt as string
  transactionHash: string; // Bytes
}

export interface IndexerProtocol {
  id: string;
  totalAgents: number;
  totalActiveAgents: number;
  totalFeedback: number;
  totalActiveFeedback: number;
  totalRatingSum: number;
  averageRating: string; // BigDecimal as string
  totalValidationRequests: number;
  totalValidationsPassed: number;
  totalValidationsFailed: number;
  wtagTotalSupply: string; // BigInt as string
  wtagTotalTransfers: number;
  wtagTotalBurned: string; // BigInt as string
  totalEscrows: number;
  totalEscrowsReleased: number;
  totalEscrowsCancelled: number;
  totalEscrowVolume: string; // BigInt as string
}

// ─── Query Response Types ───────────────────────────────────────────────

export interface AgentActivityResponse {
  agentStatusChanges: IndexerAgentStatusChange[];
}

export interface AgentFeedbackResponse {
  feedbacks: IndexerFeedback[];
}

export interface AgentValidationResponse {
  validationRequests: IndexerValidationRequest[];
}

export interface RewardDistributionsResponse {
  rewardDistributions: IndexerRewardDistribution[];
}

export interface WTagHoldersResponse {
  wtagAccounts: IndexerWTagAccount[];
}

export interface WTagTransfersResponse {
  wtagTransfers: IndexerWTagTransfer[];
}

export interface ProtocolResponse {
  protocol: IndexerProtocol | null;
}

// ─── Parsed UI Types ────────────────────────────────────────────────────

export type AgentActivityType =
  | "status_change"
  | "feedback"
  | "validation"
  | "reward";

export interface AgentActivityEvent {
  id: string;
  type: AgentActivityType;
  agentAddress: string;
  agentId: string;
  description: string;
  timestamp: number; // ms
  txHash: string;
  blockNumber: string;
}

export interface WTagHolder {
  address: string;
  balance: bigint;
  transfersSent: number;
  transfersReceived: number;
  /** percentage of total supply (0-100) */
  sharePercent: number;
}

export interface WTagTransferEvent {
  id: string;
  from: string;
  to: string;
  value: bigint;
  timestamp: number; // ms
  txHash: string;
}

export interface WTagDistributionSummary {
  totalSupply: bigint;
  totalTransfers: number;
  totalBurned: bigint;
  holders: WTagHolder[];
  recentTransfers: WTagTransferEvent[];
}
