import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { UseTreasurySpendReturn, SpendReportResponse } from "@/lib/hooks/use-treasury-spend";

// ─── Mocks ──────────────────────────────────────────────────────────────

const mockUseTreasurySpend = vi.fn<() => UseTreasurySpendReturn>();
const mockUseChainId = vi.fn();

vi.mock("@/lib/hooks/use-treasury-spend", () => ({
  useTreasurySpend: () => mockUseTreasurySpend(),
}));

vi.mock("wagmi", () => ({
  useChainId: () => mockUseChainId(),
}));

vi.mock("@tagit/contracts", () => ({
  getExplorerTxUrl: (chainId: number, txHash: string) =>
    `https://explorer.example/${txHash}`,
  shortenAddress: (addr: string) =>
    addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "",
}));

vi.mock("@tagit/ui", () => ({
  Card: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div data-testid={props["data-testid"]} className={props.className as string}>{children}</div>
  ),
  CardHeader: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  CardTitle: ({ children }: React.PropsWithChildren) => <h3>{children}</h3>,
  CardContent: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div data-testid={props["data-testid"]} className={props.className as string}>{children}</div>
  ),
  CardDescription: ({ children }: React.PropsWithChildren) => <p>{children}</p>,
  Badge: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <span data-testid={props["data-testid"]}>{children}</span>
  ),
  Button: ({ children, onClick, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <button onClick={onClick as () => void} data-testid={props["data-testid"]}>{children}</button>
  ),
  Input: (props: Record<string, unknown>) => (
    <input data-testid={props["data-testid"]} placeholder={props.placeholder as string} />
  ),
  MetricCard: ({ title, value }: { title: string; value: string }) => (
    <div data-testid={`metric-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <span>{title}</span>
      <span>{value}</span>
    </div>
  ),
  AddressBadge: ({ address }: { address: string }) => (
    <span>{address.slice(0, 6)}...{address.slice(-4)}</span>
  ),
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  BarChart: ({ children }: React.PropsWithChildren) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />,
  CartesianGrid: () => <div />,
}));

vi.mock("@tanstack/react-table", async () => {
  const actual = await vi.importActual("@tanstack/react-table");
  return actual;
});

import TreasurySpendPage from "@/app/treasury/spend/page";
import { SpendChart } from "@/components/treasury/spend-chart";
import { SpendTable } from "@/components/treasury/spend-table";

// ─── Test Data ──────────────────────────────────────────────────────────

const mockData: SpendReportResponse = {
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
      transactionHash: "0xabc123",
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
      timestamp: String(Math.floor(Date.now() / 1000) - 172800),
      transactionHash: "0xdef456",
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
      transactionHash: "0xghi789",
    },
  ],
  byCategory: {
    ECOSYSTEM_GRANTS: { allocated: "2000000", spent: "800000", count: 3 },
  },
  byRecipient: {
    "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD84": { total: "800000", count: 4 },
  },
  byPeriod: [
    { period: "2026-01", deposited: "3000000", spent: "500000", net: "2500000" },
    { period: "2026-02", deposited: "2500000", spent: "800000", net: "1700000" },
    { period: "2026-03", deposited: "3000000", spent: "850000", net: "2150000" },
  ],
};

// ─── Tests ──────────────────────────────────────────────────────────────

describe("TreasurySpendPage", () => {
  beforeEach(() => {
    mockUseChainId.mockReturnValue(11155420);
  });

  it("renders loading skeleton while fetching", () => {
    mockUseTreasurySpend.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    render(<TreasurySpendPage />);
    expect(screen.getByTestId("spend-skeleton")).toBeInTheDocument();
  });

  it("renders error state with retry button", () => {
    const mockRefetch = vi.fn();
    mockUseTreasurySpend.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error("Network failure"),
      refetch: mockRefetch,
    });

    render(<TreasurySpendPage />);
    expect(screen.getByTestId("spend-error")).toBeInTheDocument();
    expect(screen.getByText("Network failure")).toBeInTheDocument();
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });

  it("renders empty state when data is null", () => {
    mockUseTreasurySpend.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<TreasurySpendPage />);
    expect(screen.getByTestId("spend-empty")).toBeInTheDocument();
    expect(screen.getByText("No spend data yet")).toBeInTheDocument();
  });

  it("renders dashboard with summary metrics", () => {
    mockUseTreasurySpend.mockReturnValue({
      data: mockData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<TreasurySpendPage />);
    expect(screen.getByTestId("spend-dashboard")).toBeInTheDocument();
    expect(screen.getByText("Spend Report")).toBeInTheDocument();
    expect(screen.getByTestId("metric-total-allocated")).toBeInTheDocument();
    expect(screen.getByTestId("metric-total-spent")).toBeInTheDocument();
    expect(screen.getByTestId("metric-total-deposited")).toBeInTheDocument();
    expect(screen.getByTestId("metric-pending-withdrawals")).toBeInTheDocument();
  });

  it("renders secondary stats", () => {
    mockUseTreasurySpend.mockReturnValue({
      data: mockData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<TreasurySpendPage />);
    expect(screen.getByTestId("metric-active-allocations")).toBeInTheDocument();
    expect(screen.getByTestId("metric-executed-withdrawals")).toBeInTheDocument();
    expect(screen.getByTestId("metric-canceled-withdrawals")).toBeInTheDocument();
  });

  it("renders spend chart", () => {
    mockUseTreasurySpend.mockReturnValue({
      data: mockData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<TreasurySpendPage />);
    expect(screen.getByTestId("spend-chart")).toBeInTheDocument();
  });

  it("renders spend table with events", () => {
    mockUseTreasurySpend.mockReturnValue({
      data: mockData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<TreasurySpendPage />);
    expect(screen.getByTestId("spend-table")).toBeInTheDocument();
    expect(screen.getAllByTestId("spend-row").length).toBe(3);
  });
});

describe("SpendChart", () => {
  it("renders empty state when no period data", () => {
    render(<SpendChart byPeriod={[]} />);
    expect(screen.getByTestId("spend-chart-empty")).toBeInTheDocument();
    expect(screen.getByText("No period data available yet.")).toBeInTheDocument();
  });

  it("renders chart when period data provided", () => {
    render(<SpendChart byPeriod={mockData.byPeriod} />);
    expect(screen.getByTestId("spend-chart-container")).toBeInTheDocument();
    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
  });
});

describe("SpendTable", () => {
  beforeEach(() => {
    mockUseChainId.mockReturnValue(11155420);
  });

  it("renders table with events", () => {
    render(<SpendTable events={mockData.events} />);
    expect(screen.getByTestId("spend-table")).toBeInTheDocument();
    expect(screen.getAllByTestId("spend-row").length).toBe(3);
  });

  it("renders empty table state when no events", () => {
    render(<SpendTable events={[]} />);
    expect(screen.getByTestId("spend-table-empty")).toBeInTheDocument();
    expect(screen.getByText("No spend events found.")).toBeInTheDocument();
  });

  it("renders event type badges", () => {
    render(<SpendTable events={mockData.events} />);
    expect(screen.getByText("Spent")).toBeInTheDocument();
    expect(screen.getByText("Deposit")).toBeInTheDocument();
    expect(screen.getByText("Allocation")).toBeInTheDocument();
  });

  it("renders search input", () => {
    render(<SpendTable events={mockData.events} />);
    expect(screen.getByTestId("spend-search")).toBeInTheDocument();
  });

  it("renders filter badges", () => {
    render(<SpendTable events={mockData.events} />);
    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("Deposits")).toBeInTheDocument();
    expect(screen.getByText("Executed")).toBeInTheDocument();
    expect(screen.getByText("Queued")).toBeInTheDocument();
    expect(screen.getByText("Allocations")).toBeInTheDocument();
  });

  it("renders explorer links for transactions", () => {
    render(<SpendTable events={mockData.events} />);
    const links = screen.getAllByTitle("View on explorer");
    expect(links.length).toBeGreaterThan(0);
  });
});
