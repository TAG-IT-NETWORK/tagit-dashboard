import { useState, useEffect, useCallback } from "react";

// ─── Types ──────────────────────────────────────────────────────────────

export interface SpendEvent {
  id: string;
  type: "allocation" | "withdrawal_queued" | "withdrawal_executed" | "withdrawal_canceled" | "deposit" | "emergency_sweep";
  amount: string;
  token: string;
  recipient: string;
  programId: string | null;
  allocationId: string | null;
  status: string | null;
  timestamp: string;
  transactionHash: string;
}

export interface SpendReportSummary {
  totalAllocated: string;
  totalSpent: string;
  totalDeposited: string;
  activeAllocations: number;
  pendingWithdrawals: number;
  executedWithdrawals: number;
  canceledWithdrawals: number;
}

export interface PeriodData {
  period: string;
  deposited: string;
  spent: string;
  net: string;
}

export interface SpendReportResponse {
  summary: SpendReportSummary;
  events: SpendEvent[];
  byCategory: Record<string, { allocated: string; spent: string; count: number }>;
  byRecipient: Record<string, { total: string; count: number }>;
  byPeriod: PeriodData[];
}

export interface UseTreasurySpendReturn {
  data: SpendReportResponse | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

// ─── Mock Data for Demo Mode ────────────────────────────────────────────

const MOCK_DATA: SpendReportResponse = {
  summary: {
    totalAllocated: "5000000",
    totalSpent: "2150000",
    totalDeposited: "8500000",
    activeAllocations: 4,
    pendingWithdrawals: 2,
    executedWithdrawals: 12,
    canceledWithdrawals: 1,
  },
  events: [
    {
      id: "w-exec-1",
      type: "withdrawal_executed",
      amount: "500000",
      token: "0x0000000000000000000000000000000000000000",
      recipient: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD84",
      programId: null,
      allocationId: "1",
      status: "EXECUTED",
      timestamp: String(Math.floor(Date.now() / 1000) - 86400),
      transactionHash: "0xabc123def456abc123def456abc123def456abc123def456abc123def456abcd",
    },
    {
      id: "w-pend-1",
      type: "withdrawal_queued",
      amount: "250000",
      token: "0x0000000000000000000000000000000000000000",
      recipient: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
      programId: null,
      allocationId: "2",
      status: "PENDING",
      timestamp: String(Math.floor(Date.now() / 1000) - 172800),
      transactionHash: "0xdef456abc789def456abc789def456abc789def456abc789def456abc789defg",
    },
    {
      id: "alloc-1",
      type: "allocation",
      amount: "1000000",
      token: "",
      recipient: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD84",
      programId: "ECOSYSTEM_GRANTS",
      allocationId: "1",
      status: "active",
      timestamp: String(Math.floor(Date.now() / 1000) - 259200),
      transactionHash: "0x111222333444555666777888999000111222333444555666777888999000aabb",
    },
    {
      id: "dep-1",
      type: "deposit",
      amount: "2000000",
      token: "0x0000000000000000000000000000000000000000",
      recipient: "",
      programId: null,
      allocationId: null,
      status: null,
      timestamp: String(Math.floor(Date.now() / 1000) - 345600),
      transactionHash: "0xccccddddeeee1111222233334444555566667777888899990000aaaabbbbcccc",
    },
    {
      id: "alloc-2",
      type: "allocation",
      amount: "750000",
      token: "",
      recipient: "0x71bE63f3384f5fb98995898A86B02Fb2426c5788",
      programId: "SECURITY_AUDITS",
      allocationId: "3",
      status: "active",
      timestamp: String(Math.floor(Date.now() / 1000) - 432000),
      transactionHash: "0xddddeeee1111222233334444555566667777888899990000aaaabbbbccccdddd",
    },
    {
      id: "w-exec-2",
      type: "withdrawal_executed",
      amount: "300000",
      token: "0x0000000000000000000000000000000000000000",
      recipient: "0x71bE63f3384f5fb98995898A86B02Fb2426c5788",
      programId: null,
      allocationId: "3",
      status: "EXECUTED",
      timestamp: String(Math.floor(Date.now() / 1000) - 518400),
      transactionHash: "0xeeee1111222233334444555566667777888899990000aaaabbbbccccddddeeee",
    },
    {
      id: "w-cancel-1",
      type: "withdrawal_canceled",
      amount: "100000",
      token: "0x0000000000000000000000000000000000000000",
      recipient: "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720",
      programId: null,
      allocationId: "2",
      status: "CANCELED",
      timestamp: String(Math.floor(Date.now() / 1000) - 604800),
      transactionHash: "0x1111222233334444555566667777888899990000aaaabbbbccccddddeeee1111",
    },
    {
      id: "dep-2",
      type: "deposit",
      amount: "1500000",
      token: "0x0000000000000000000000000000000000000000",
      recipient: "",
      programId: null,
      allocationId: null,
      status: null,
      timestamp: String(Math.floor(Date.now() / 1000) - 691200),
      transactionHash: "0x222233334444555566667777888899990000aaaabbbbccccddddeeee11112222",
    },
  ],
  byCategory: {
    ECOSYSTEM_GRANTS: { allocated: "2000000", spent: "800000", count: 3 },
    SECURITY_AUDITS: { allocated: "1500000", spent: "750000", count: 2 },
    MARKETING: { allocated: "1000000", spent: "400000", count: 2 },
    DEVELOPMENT: { allocated: "500000", spent: "200000", count: 1 },
  },
  byRecipient: {
    "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD84": { total: "800000", count: 4 },
    "0x71bE63f3384f5fb98995898A86B02Fb2426c5788": { total: "750000", count: 3 },
    "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc": { total: "400000", count: 3 },
    "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720": { total: "200000", count: 2 },
  },
  byPeriod: [
    { period: "2026-01", deposited: "3000000", spent: "500000", net: "2500000" },
    { period: "2026-02", deposited: "2500000", spent: "800000", net: "1700000" },
    { period: "2026-03", deposited: "3000000", spent: "850000", net: "2150000" },
  ],
};

// ─── Hook ───────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

export function useTreasurySpend(): UseTreasurySpendReturn {
  const [data, setData] = useState<SpendReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (!API_BASE) {
        // Demo mode — use mock data
        await new Promise((r) => setTimeout(r, 300));
        setData(MOCK_DATA);
        return;
      }

      const res = await fetch(`${API_BASE}/api/v1/treasury/spend-report`);
      if (!res.ok) {
        throw new Error(`API error: ${res.status} ${res.statusText}`);
      }
      const json = (await res.json()) as SpendReportResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}
