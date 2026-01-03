import type { Priority } from "@tagit/ui";

export interface FlaggedAsset {
  tokenId: string;
  flagReason: string;
  flaggedBy: string;
  flaggedAt: number;
  txHash: string;
  previousState: number;
  owner: string;
  tagId: string | null;
  metadataURI: string;
}

export interface ResolutionRecord {
  tokenId: string;
  resolution: 0 | 1 | 2; // CLEAR | QUARANTINE | DECOMMISSION
  resolver: string;
  notes: string;
  timestamp: number;
  txHash: string;
}

// Generate mock flagged assets
export const mockFlaggedAssets: FlaggedAsset[] = [
  {
    tokenId: "1042",
    flagReason: "Suspected counterfeit product. Tag ID does not match manufacturer records. Multiple authentication failures detected.",
    flaggedBy: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD84",
    flaggedAt: Date.now() - 72 * 60 * 60 * 1000, // 72 hours ago
    txHash: "0xabc123...def456",
    previousState: 2, // Was ACTIVATED
    owner: "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
    tagId: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    metadataURI: "ipfs://QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
  },
  {
    tokenId: "1156",
    flagReason: "Ownership chain irregularity. Asset transferred through suspicious addresses.",
    flaggedBy: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
    flaggedAt: Date.now() - 36 * 60 * 60 * 1000, // 36 hours ago
    txHash: "0x456789...abc123",
    previousState: 3, // Was CLAIMED
    owner: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
    tagId: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    metadataURI: "ipfs://QmT5NvUtoM5nWFfrQdVrFtvGfKFmG7AHE8P34isapyhCxX",
  },
  {
    tokenId: "1089",
    flagReason: "Customer complaint: Product authentication failed at retail location.",
    flaggedBy: "0x71bE63f3384f5fb98995898A86B02Fb2426c5788",
    flaggedAt: Date.now() - 18 * 60 * 60 * 1000, // 18 hours ago
    txHash: "0x789abc...456def",
    previousState: 2, // Was ACTIVATED
    owner: "0x976EA74026E726554dB657fA54763abd0C3a0aa9",
    tagId: "0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321",
    metadataURI: "ipfs://QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn",
  },
  {
    tokenId: "1203",
    flagReason: "Duplicate tag detected. Same tag ID found on multiple assets.",
    flaggedBy: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD84",
    flaggedAt: Date.now() - 8 * 60 * 60 * 1000, // 8 hours ago
    txHash: "0xdef456...789abc",
    previousState: 1, // Was BOUND
    owner: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    tagId: "0x5555555555555555555555555555555555555555555555555555555555555555",
    metadataURI: "ipfs://QmPK1s3pNYLi9ERiq3BDxKa4XosgWwFRQUydHUtz4YgpqB",
  },
  {
    tokenId: "1178",
    flagReason: "Metadata tampering suspected. Hash mismatch detected during verification.",
    flaggedBy: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
    flaggedAt: Date.now() - 52 * 60 * 60 * 1000, // 52 hours ago
    txHash: "0x123456...abcdef",
    previousState: 2, // Was ACTIVATED
    owner: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    tagId: "0x9999999999999999999999999999999999999999999999999999999999999999",
    metadataURI: "ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
  },
  {
    tokenId: "1234",
    flagReason: "Reported stolen by original owner. Theft report filed with law enforcement.",
    flaggedBy: "0x71bE63f3384f5fb98995898A86B02Fb2426c5788",
    flaggedAt: Date.now() - 96 * 60 * 60 * 1000, // 96 hours ago
    txHash: "0xfedcba...123456",
    previousState: 3, // Was CLAIMED
    owner: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    tagId: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    metadataURI: "ipfs://QmZ4tDuvesekSs4qM5ZBKpXiZGun7S2CYtEZRB3DYXkjGx",
  },
];

// Mock resolution history
export const mockResolutionHistory: ResolutionRecord[] = [
  {
    tokenId: "1001",
    resolution: 0, // CLEAR
    resolver: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD84",
    notes: "Asset verified authentic through manufacturer confirmation. Tag scan matched production records.",
    timestamp: Date.now() - 24 * 60 * 60 * 1000,
    txHash: "0xres001...abc",
  },
  {
    tokenId: "1015",
    resolution: 2, // DECOMMISSION
    resolver: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
    notes: "Confirmed counterfeit product. Tag was cloned. Asset permanently decommissioned.",
    timestamp: Date.now() - 48 * 60 * 60 * 1000,
    txHash: "0xres015...def",
  },
  {
    tokenId: "1028",
    resolution: 1, // QUARANTINE
    resolver: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD84",
    notes: "Pending investigation with manufacturer. Extended hold for 30 days.",
    timestamp: Date.now() - 72 * 60 * 60 * 1000,
    txHash: "0xres028...ghi",
  },
];

// Calculate stats
export function getFlagQueueStats() {
  const total = mockFlaggedAssets.length;
  const now = Date.now();
  const pendingReview = mockFlaggedAssets.filter(
    (a) => now - a.flaggedAt > 24 * 60 * 60 * 1000
  ).length;
  const resolvedToday = mockResolutionHistory.filter(
    (r) => now - r.timestamp < 24 * 60 * 60 * 1000
  ).length;

  // Calculate average resolution time from history
  const avgResolutionTime =
    mockResolutionHistory.length > 0
      ? mockResolutionHistory.reduce((sum, r) => sum + (24 * 60 * 60 * 1000), 0) /
        mockResolutionHistory.length
      : 0;

  return {
    totalFlagged: total,
    pendingReview,
    resolvedToday,
    avgResolutionTimeMs: avgResolutionTime,
  };
}
