import type { ProposalState } from "@tagit/ui";

export interface Vote {
  voter: string;
  support: 0 | 1 | 2; // Against, For, Abstain
  weight: number;
  reason?: string;
  house: "token" | "brand" | "technical";
  timestamp: number;
}

export interface Proposal {
  id: string;
  title: string;
  description: string;
  proposer: string;
  state: ProposalState;
  createdAt: number;
  startTime: number;
  endTime: number;
  executedAt?: number;
  forVotes: number;
  againstVotes: number;
  abstainVotes: number;
  quorum: number;
  votes: Vote[];
  targets: string[];
  values: string[];
  calldatas: string[];
  category: "protocol" | "parameter" | "treasury" | "other";
}

export interface HouseVotes {
  house: "token" | "brand" | "technical";
  forVotes: number;
  againstVotes: number;
  abstainVotes: number;
  quorum: number;
  quorumReached: boolean;
}

// Mock proposals
export const mockProposals: Proposal[] = [
  {
    id: "1",
    title: "Update Minimum Stake Requirement",
    description: `## Summary
This proposal updates the minimum stake requirement for manufacturers from 100 TAGIT to 250 TAGIT.

## Motivation
The current 100 TAGIT requirement is too low and has led to an influx of low-quality manufacturers. By increasing the stake, we ensure only serious participants join the network.

## Specification
- Update \`MIN_MANUFACTURER_STAKE\` from 100 to 250
- Grace period of 30 days for existing manufacturers to meet new requirement
- No changes to other stake levels

## Timeline
- Voting: 7 days
- Timelock: 2 days
- Execution: Immediate after timelock`,
    proposer: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD84",
    state: "ACTIVE",
    createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
    startTime: Date.now() - 2 * 24 * 60 * 60 * 1000,
    endTime: Date.now() + 5 * 24 * 60 * 60 * 1000,
    forVotes: 15000,
    againstVotes: 3500,
    abstainVotes: 1200,
    quorum: 10000,
    votes: [],
    targets: ["0x6a58eE8f2d500981b1793868C55072789c58fba6"],
    values: ["0"],
    calldatas: ["0x..."],
    category: "parameter",
  },
  {
    id: "2",
    title: "Treasury Allocation for Marketing Q1",
    description: `## Summary
Allocate 50,000 TAGIT from treasury for Q1 marketing initiatives.

## Details
- Social media campaigns: 20,000 TAGIT
- Influencer partnerships: 15,000 TAGIT
- Event sponsorships: 10,000 TAGIT
- Content creation: 5,000 TAGIT`,
    proposer: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
    state: "ACTIVE",
    createdAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
    startTime: Date.now() - 12 * 60 * 60 * 1000,
    endTime: Date.now() + 6 * 24 * 60 * 60 * 1000,
    forVotes: 8000,
    againstVotes: 2000,
    abstainVotes: 500,
    quorum: 10000,
    votes: [],
    targets: ["0xTreasury..."],
    values: ["0"],
    calldatas: ["0x..."],
    category: "treasury",
  },
  {
    id: "3",
    title: "Add New Badge Category: Premium Retailer",
    description: `## Summary
Introduce a new badge category for premium retailers with enhanced verification.`,
    proposer: "0x71bE63f3384f5fb98995898A86B02Fb2426c5788",
    state: "SUCCEEDED",
    createdAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
    startTime: Date.now() - 9 * 24 * 60 * 60 * 1000,
    endTime: Date.now() - 2 * 24 * 60 * 60 * 1000,
    forVotes: 25000,
    againstVotes: 5000,
    abstainVotes: 2000,
    quorum: 10000,
    votes: [],
    targets: ["0xb3f757fca307a7febA5CA210Cd7D840EC0999be8"],
    values: ["0"],
    calldatas: ["0x..."],
    category: "protocol",
  },
  {
    id: "4",
    title: "Reduce Resolution Timelock",
    description: `## Summary
Reduce the timelock for AIRP resolutions from 48 hours to 24 hours.`,
    proposer: "0x976EA74026E726554dB657fA54763abd0C3a0aa9",
    state: "DEFEATED",
    createdAt: Date.now() - 15 * 24 * 60 * 60 * 1000,
    startTime: Date.now() - 14 * 24 * 60 * 60 * 1000,
    endTime: Date.now() - 7 * 24 * 60 * 60 * 1000,
    forVotes: 4000,
    againstVotes: 18000,
    abstainVotes: 1000,
    quorum: 10000,
    votes: [],
    targets: ["0x6a58eE8f2d500981b1793868C55072789c58fba6"],
    values: ["0"],
    calldatas: ["0x..."],
    category: "parameter",
  },
  {
    id: "5",
    title: "Protocol Upgrade v2.1",
    description: `## Summary
Major protocol upgrade including gas optimizations and new features.`,
    proposer: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD84",
    state: "EXECUTED",
    createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
    startTime: Date.now() - 29 * 24 * 60 * 60 * 1000,
    endTime: Date.now() - 22 * 24 * 60 * 60 * 1000,
    executedAt: Date.now() - 20 * 24 * 60 * 60 * 1000,
    forVotes: 45000,
    againstVotes: 2000,
    abstainVotes: 3000,
    quorum: 10000,
    votes: [],
    targets: ["0x6a58eE8f2d500981b1793868C55072789c58fba6"],
    values: ["0"],
    calldatas: ["0x..."],
    category: "protocol",
  },
  {
    id: "6",
    title: "Emergency Pause Capability Update",
    description: `## Summary
Update the emergency pause mechanism to require multi-sig approval.`,
    proposer: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
    state: "QUEUED",
    createdAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
    startTime: Date.now() - 7 * 24 * 60 * 60 * 1000,
    endTime: Date.now() - 1 * 24 * 60 * 60 * 1000,
    forVotes: 30000,
    againstVotes: 4000,
    abstainVotes: 1500,
    quorum: 10000,
    votes: [],
    targets: ["0x6a58eE8f2d500981b1793868C55072789c58fba6"],
    values: ["0"],
    calldatas: ["0x..."],
    category: "protocol",
  },
];

// Generate mock votes for a proposal
export function generateMockVotes(proposalId: string): Vote[] {
  const houses: ("token" | "brand" | "technical")[] = ["token", "brand", "technical"];
  const votes: Vote[] = [];

  for (let i = 0; i < 20; i++) {
    votes.push({
      voter: `0x${Math.random().toString(16).slice(2, 42)}`,
      support: Math.floor(Math.random() * 3) as 0 | 1 | 2,
      weight: Math.floor(Math.random() * 5000) + 100,
      reason: Math.random() > 0.7 ? "Strong support for this proposal" : undefined,
      house: houses[Math.floor(Math.random() * 3)],
      timestamp: Date.now() - Math.random() * 5 * 24 * 60 * 60 * 1000,
    });
  }

  return votes;
}

// Calculate house votes
export function calculateHouseVotes(votes: Vote[]): HouseVotes[] {
  const houses: ("token" | "brand" | "technical")[] = ["token", "brand", "technical"];
  const quorums = { token: 5000, brand: 20, technical: 10 };

  return houses.map((house) => {
    const houseVotes = votes.filter((v) => v.house === house);
    const forVotes = houseVotes
      .filter((v) => v.support === 1)
      .reduce((sum, v) => sum + v.weight, 0);
    const againstVotes = houseVotes
      .filter((v) => v.support === 0)
      .reduce((sum, v) => sum + v.weight, 0);
    const abstainVotes = houseVotes
      .filter((v) => v.support === 2)
      .reduce((sum, v) => sum + v.weight, 0);
    const total = forVotes + againstVotes + abstainVotes;
    const quorum = quorums[house];

    return {
      house,
      forVotes,
      againstVotes,
      abstainVotes,
      quorum,
      quorumReached: total >= quorum,
    };
  });
}

// Get governance stats
export function getGovernanceStats() {
  const activeCount = mockProposals.filter((p) => p.state === "ACTIVE").length;
  const totalCount = mockProposals.length;
  const participationRate = 0.68; // Mock 68% participation
  const quorumThreshold = 10000;

  return {
    activeProposals: activeCount,
    totalProposals: totalCount,
    participationRate,
    quorumThreshold,
  };
}
