import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ─── Mocks ──────────────────────────────────────────────────────────────

const mockUseWTagDistribution = vi.fn();
const mockUseChainId = vi.fn();

vi.mock("@tagit/contracts", () => ({
  useWTagDistribution: () => mockUseWTagDistribution(),
  shortenAddress: (addr: string) =>
    addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "",
  getExplorerTxUrl: (chainId: number, txHash: string) =>
    `https://explorer.example/${txHash}`,
}));

vi.mock("wagmi", () => ({
  useChainId: () => mockUseChainId(),
}));

vi.mock("@tagit/ui", () => ({
  Card: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div data-testid={props["data-testid"]}>{children}</div>
  ),
  CardHeader: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  CardTitle: ({ children }: React.PropsWithChildren) => <h3>{children}</h3>,
  CardContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  CardDescription: ({ children }: React.PropsWithChildren) => <p>{children}</p>,
  Badge: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AreaChart: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  Area: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
}));

import { WTagDistributionTracker } from "../wtag-distribution-tracker";
import type { WTagDistributionSummary } from "@tagit/contracts";

// ─── Test Data ──────────────────────────────────────────────────────────

const mockDistribution: WTagDistributionSummary = {
  totalSupply: 1000000n * 10n ** 18n, // 1M tokens
  totalTransfers: 542,
  totalBurned: 5000n * 10n ** 18n, // 5K burned
  holders: [
    {
      address: "0x1234567890abcdef1234567890abcdef12345678",
      balance: 250000n * 10n ** 18n,
      transfersSent: 15,
      transfersReceived: 20,
      sharePercent: 25.0,
    },
    {
      address: "0xabcdef1234567890abcdef1234567890abcdef01",
      balance: 150000n * 10n ** 18n,
      transfersSent: 10,
      transfersReceived: 12,
      sharePercent: 15.0,
    },
    {
      address: "0x9876543210fedcba9876543210fedcba98765432",
      balance: 100000n * 10n ** 18n,
      transfersSent: 5,
      transfersReceived: 8,
      sharePercent: 10.0,
    },
  ],
  recentTransfers: [
    {
      id: "t1",
      from: "0x1234567890abcdef1234567890abcdef12345678",
      to: "0xabcdef1234567890abcdef1234567890abcdef01",
      value: 1000n * 10n ** 18n,
      timestamp: Date.now() - 60000,
      txHash: "0xaaa111bbb222",
    },
    {
      id: "t2",
      from: "0xabcdef1234567890abcdef1234567890abcdef01",
      to: "0x9876543210fedcba9876543210fedcba98765432",
      value: 500n * 10n ** 18n,
      timestamp: Date.now() - 120000,
      txHash: "0xccc333ddd444",
    },
  ],
};

// ─── Tests ──────────────────────────────────────────────────────────────

describe("WTagDistributionTracker", () => {
  beforeEach(() => {
    mockUseChainId.mockReturnValue(11155420); // OP Sepolia
  });

  it("renders the component title", () => {
    mockUseWTagDistribution.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      enabled: true,
    });

    render(<WTagDistributionTracker />);
    expect(screen.getByText("wTAG Distribution")).toBeInTheDocument();
  });

  it("shows loading skeleton while fetching", () => {
    mockUseWTagDistribution.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
      enabled: true,
    });

    render(<WTagDistributionTracker />);
    expect(screen.getByTestId("distribution-skeleton")).toBeInTheDocument();
  });

  it("shows empty state when no data and enabled", () => {
    mockUseWTagDistribution.mockReturnValue({
      data: { totalSupply: 0n, totalTransfers: 0, totalBurned: 0n, holders: [], recentTransfers: [] },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      enabled: true,
    });

    render(<WTagDistributionTracker />);
    expect(screen.getByTestId("distribution-empty")).toBeInTheDocument();
    expect(screen.getByText("No wTAG data yet")).toBeInTheDocument();
  });

  it("shows empty state when subgraph not enabled", () => {
    mockUseWTagDistribution.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      enabled: false,
    });

    render(<WTagDistributionTracker />);
    expect(screen.getByTestId("distribution-empty")).toBeInTheDocument();
  });

  it("shows error state with retry button", () => {
    const mockRefetch = vi.fn();
    mockUseWTagDistribution.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error("Subgraph unavailable"),
      refetch: mockRefetch,
      enabled: true,
    });

    render(<WTagDistributionTracker />);
    expect(screen.getByTestId("distribution-error")).toBeInTheDocument();
    expect(screen.getByText("Subgraph unavailable")).toBeInTheDocument();
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });

  it("renders supply, transfers, and burned stats", () => {
    mockUseWTagDistribution.mockReturnValue({
      data: mockDistribution,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      enabled: true,
    });

    render(<WTagDistributionTracker />);

    // 1M total supply → "1.0M"
    expect(screen.getByText("1.0M")).toBeInTheDocument();
    // 542 transfers
    expect(screen.getByText("542")).toBeInTheDocument();
    // 5K burned → "5.0K"
    expect(screen.getByText("5.0K")).toBeInTheDocument();
  });

  it("renders holder rows with rank and percentage", () => {
    mockUseWTagDistribution.mockReturnValue({
      data: mockDistribution,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      enabled: true,
    });

    render(<WTagDistributionTracker />);

    // Check holder ranks
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();

    // Check share percentages
    expect(screen.getByText("25.0%")).toBeInTheDocument();
    expect(screen.getByText("15.0%")).toBeInTheDocument();
    expect(screen.getByText("10.0%")).toBeInTheDocument();
  });

  it("renders holder balances formatted", () => {
    mockUseWTagDistribution.mockReturnValue({
      data: mockDistribution,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      enabled: true,
    });

    render(<WTagDistributionTracker />);

    // 250K, 150K, 100K
    expect(screen.getByText("250.0K")).toBeInTheDocument();
    expect(screen.getByText("150.0K")).toBeInTheDocument();
    expect(screen.getByText("100.0K")).toBeInTheDocument();
  });

  it("shows Top N Holders label", () => {
    mockUseWTagDistribution.mockReturnValue({
      data: mockDistribution,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      enabled: true,
    });

    render(<WTagDistributionTracker />);
    expect(screen.getByText("Top 3 Holders")).toBeInTheDocument();
  });

  it("renders transfer sparkline when transfers exist", () => {
    mockUseWTagDistribution.mockReturnValue({
      data: mockDistribution,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      enabled: true,
    });

    render(<WTagDistributionTracker />);
    expect(screen.getByTestId("transfer-sparkline")).toBeInTheDocument();
  });

  it("does not render sparkline with fewer than 2 transfers", () => {
    mockUseWTagDistribution.mockReturnValue({
      data: {
        ...mockDistribution,
        recentTransfers: [mockDistribution.recentTransfers[0]],
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      enabled: true,
    });

    render(<WTagDistributionTracker />);
    expect(screen.queryByTestId("transfer-sparkline")).not.toBeInTheDocument();
  });

  it("does not show loading spinner when not loading", () => {
    mockUseWTagDistribution.mockReturnValue({
      data: mockDistribution,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      enabled: true,
    });

    const { container } = render(<WTagDistributionTracker />);
    expect(container.querySelector(".animate-spin")).not.toBeInTheDocument();
  });
});
