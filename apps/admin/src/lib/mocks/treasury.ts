export interface TreasuryReserve {
  token: string;
  symbol: string;
  balance: number;
  valueUSD: number;
  percentage: number;
}

export interface TreasuryTransaction {
  id: string;
  type: "inflow" | "outflow";
  token: string;
  amount: number;
  valueUSD: number;
  from: string;
  to: string;
  description: string;
  proposalId?: string;
  timestamp: number;
  txHash: string;
}

export interface TreasuryStats {
  totalValueUSD: number;
  totalInflows30d: number;
  totalOutflows30d: number;
  netChange30d: number;
  pendingProposals: number;
}

// Mock treasury reserves
export const mockTreasuryReserves: TreasuryReserve[] = [
  {
    token: "TAGIT",
    symbol: "TAGIT",
    balance: 5000000,
    valueUSD: 2500000,
    percentage: 50,
  },
  {
    token: "USDC",
    symbol: "USDC",
    balance: 1500000,
    valueUSD: 1500000,
    percentage: 30,
  },
  {
    token: "ETH",
    symbol: "ETH",
    balance: 250,
    valueUSD: 750000,
    percentage: 15,
  },
  {
    token: "WBTC",
    symbol: "WBTC",
    balance: 5,
    valueUSD: 250000,
    percentage: 5,
  },
];

// Mock treasury transactions
export const mockTreasuryTransactions: TreasuryTransaction[] = [
  {
    id: "1",
    type: "outflow",
    token: "TAGIT",
    amount: 50000,
    valueUSD: 25000,
    from: "0xTreasury...",
    to: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD84",
    description: "Q4 Marketing Budget Allocation",
    proposalId: "12",
    timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000,
    txHash: "0xabc123...",
  },
  {
    id: "2",
    type: "inflow",
    token: "USDC",
    amount: 100000,
    valueUSD: 100000,
    from: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
    to: "0xTreasury...",
    description: "Protocol Fee Revenue",
    timestamp: Date.now() - 3 * 24 * 60 * 60 * 1000,
    txHash: "0xdef456...",
  },
  {
    id: "3",
    type: "outflow",
    token: "ETH",
    amount: 10,
    valueUSD: 30000,
    from: "0xTreasury...",
    to: "0x71bE63f3384f5fb98995898A86B02Fb2426c5788",
    description: "Security Audit Payment",
    proposalId: "11",
    timestamp: Date.now() - 5 * 24 * 60 * 60 * 1000,
    txHash: "0xghi789...",
  },
  {
    id: "4",
    type: "inflow",
    token: "TAGIT",
    amount: 200000,
    valueUSD: 100000,
    from: "0x976EA74026E726554dB657fA54763abd0C3a0aa9",
    to: "0xTreasury...",
    description: "Staking Rewards Recycled",
    timestamp: Date.now() - 7 * 24 * 60 * 60 * 1000,
    txHash: "0xjkl012...",
  },
  {
    id: "5",
    type: "outflow",
    token: "USDC",
    amount: 75000,
    valueUSD: 75000,
    from: "0xTreasury...",
    to: "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955",
    description: "Development Grant - Team Alpha",
    proposalId: "10",
    timestamp: Date.now() - 10 * 24 * 60 * 60 * 1000,
    txHash: "0xmno345...",
  },
  {
    id: "6",
    type: "inflow",
    token: "ETH",
    amount: 50,
    valueUSD: 150000,
    from: "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f",
    to: "0xTreasury...",
    description: "NFT Royalty Revenue",
    timestamp: Date.now() - 12 * 24 * 60 * 60 * 1000,
    txHash: "0xpqr678...",
  },
  {
    id: "7",
    type: "outflow",
    token: "TAGIT",
    amount: 25000,
    valueUSD: 12500,
    from: "0xTreasury...",
    to: "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720",
    description: "Community Incentives Program",
    proposalId: "9",
    timestamp: Date.now() - 15 * 24 * 60 * 60 * 1000,
    txHash: "0xstu901...",
  },
  {
    id: "8",
    type: "inflow",
    token: "USDC",
    amount: 250000,
    valueUSD: 250000,
    from: "0xBcd4042DE499D14e55001CcbB24a551F3b954096",
    to: "0xTreasury...",
    description: "Partnership Deal - Company X",
    timestamp: Date.now() - 20 * 24 * 60 * 60 * 1000,
    txHash: "0xvwx234...",
  },
];

// Calculate treasury stats
export function getTreasuryStats(): TreasuryStats {
  const totalValueUSD = mockTreasuryReserves.reduce((sum, r) => sum + r.valueUSD, 0);

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentTransactions = mockTreasuryTransactions.filter(
    (tx) => tx.timestamp >= thirtyDaysAgo
  );

  const totalInflows30d = recentTransactions
    .filter((tx) => tx.type === "inflow")
    .reduce((sum, tx) => sum + tx.valueUSD, 0);

  const totalOutflows30d = recentTransactions
    .filter((tx) => tx.type === "outflow")
    .reduce((sum, tx) => sum + tx.valueUSD, 0);

  const netChange30d = totalInflows30d - totalOutflows30d;

  // Count pending treasury proposals (mock)
  const pendingProposals = 2;

  return {
    totalValueUSD,
    totalInflows30d,
    totalOutflows30d,
    netChange30d,
    pendingProposals,
  };
}

// Get token color for charts
export function getTokenColor(symbol: string): string {
  switch (symbol) {
    case "TAGIT":
      return "#8b5cf6"; // purple
    case "USDC":
      return "#2775ca"; // blue
    case "ETH":
      return "#627eea"; // ethereum blue
    case "WBTC":
      return "#f7931a"; // bitcoin orange
    default:
      return "#6b7280"; // gray
  }
}
