import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ─── Mocks ──────────────────────────────────────────────────────────────

const mockUseAgentActivity = vi.fn();
const mockUseChainId = vi.fn();

vi.mock("@tagit/contracts", () => ({
  useAgentActivity: () => mockUseAgentActivity(),
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

// Mock recharts (not used in this component but just in case)
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AreaChart: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  Area: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
}));

import { AgentActivityMonitor } from "../agent-activity-monitor";
import type { AgentActivityEvent } from "@tagit/contracts";

// ─── Test Data ──────────────────────────────────────────────────────────

const mockEvents: AgentActivityEvent[] = [
  {
    id: "sc-1",
    type: "status_change",
    agentAddress: "0x1234567890abcdef1234567890abcdef12345678",
    agentId: "1",
    description: "Agent 0x1234...5678 status: INACTIVE \u2192 ACTIVE",
    timestamp: Date.now() - 60000,
    txHash: "0xabc123def456",
    blockNumber: "100",
  },
  {
    id: "fb-1",
    type: "feedback",
    agentAddress: "0xabcdef1234567890abcdef1234567890abcdef01",
    agentId: "2",
    description: "Feedback (\u2605 4) for agent 0xabcd...ef01",
    timestamp: Date.now() - 120000,
    txHash: "0xdef456abc789",
    blockNumber: "99",
  },
  {
    id: "vr-1",
    type: "validation",
    agentAddress: "0x9876543210fedcba9876543210fedcba98765432",
    agentId: "3",
    description: "Validation PASSED for agent 0x9876...5432 (3 responses)",
    timestamp: Date.now() - 180000,
    txHash: "0x789abc123def",
    blockNumber: "98",
  },
  {
    id: "rw-1",
    type: "reward",
    agentAddress: "0x1111222233334444555566667777888899990000",
    agentId: "",
    description: "ECOSYSTEM reward to 0x1111...0000",
    timestamp: Date.now() - 240000,
    txHash: "0x111222333444",
    blockNumber: "97",
  },
];

// ─── Tests ──────────────────────────────────────────────────────────────

describe("AgentActivityMonitor", () => {
  beforeEach(() => {
    mockUseChainId.mockReturnValue(11155420); // OP Sepolia
  });

  it("renders the component title", () => {
    mockUseAgentActivity.mockReturnValue({
      events: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      enabled: true,
    });

    render(<AgentActivityMonitor />);
    expect(screen.getByText("Agent Activity")).toBeInTheDocument();
  });

  it("shows loading skeleton while fetching", () => {
    mockUseAgentActivity.mockReturnValue({
      events: [],
      isLoading: true,
      error: null,
      refetch: vi.fn(),
      enabled: true,
    });

    render(<AgentActivityMonitor />);
    expect(screen.getByTestId("activity-skeleton")).toBeInTheDocument();
  });

  it("shows empty state when no events and enabled", () => {
    mockUseAgentActivity.mockReturnValue({
      events: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      enabled: true,
    });

    render(<AgentActivityMonitor />);
    expect(screen.getByTestId("activity-empty")).toBeInTheDocument();
    expect(screen.getByText("No agent activity yet")).toBeInTheDocument();
  });

  it("shows empty state when subgraph not enabled", () => {
    mockUseAgentActivity.mockReturnValue({
      events: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      enabled: false,
    });

    render(<AgentActivityMonitor />);
    expect(screen.getByTestId("activity-empty")).toBeInTheDocument();
  });

  it("shows error state with retry button", () => {
    const mockRefetch = vi.fn();
    mockUseAgentActivity.mockReturnValue({
      events: [],
      isLoading: false,
      error: new Error("Network timeout"),
      refetch: mockRefetch,
      enabled: true,
    });

    render(<AgentActivityMonitor />);
    expect(screen.getByTestId("activity-error")).toBeInTheDocument();
    expect(screen.getByText("Network timeout")).toBeInTheDocument();
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });

  it("renders event rows when data is available", () => {
    mockUseAgentActivity.mockReturnValue({
      events: mockEvents,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      enabled: true,
    });

    render(<AgentActivityMonitor />);

    // Check all 4 event types rendered
    expect(screen.getByText(/INACTIVE.*ACTIVE/)).toBeInTheDocument();
    expect(screen.getByText(/Feedback.*4/)).toBeInTheDocument();
    expect(screen.getByText(/Validation PASSED/)).toBeInTheDocument();
    expect(screen.getByText(/ECOSYSTEM reward/)).toBeInTheDocument();
  });

  it("renders type badges for each event", () => {
    mockUseAgentActivity.mockReturnValue({
      events: mockEvents,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      enabled: true,
    });

    render(<AgentActivityMonitor />);

    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Feedback")).toBeInTheDocument();
    expect(screen.getByText("Validation")).toBeInTheDocument();
    expect(screen.getByText("Reward")).toBeInTheDocument();
  });

  it("shows event count badge when events exist", () => {
    mockUseAgentActivity.mockReturnValue({
      events: mockEvents,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      enabled: true,
    });

    render(<AgentActivityMonitor />);
    expect(screen.getByText("4 events")).toBeInTheDocument();
  });

  it("renders explorer links for valid tx hashes", () => {
    mockUseAgentActivity.mockReturnValue({
      events: [mockEvents[0]],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      enabled: true,
    });

    render(<AgentActivityMonitor />);

    const explorerLinks = screen.getAllByTitle("View on explorer");
    expect(explorerLinks.length).toBeGreaterThan(0);
    expect(explorerLinks[0]).toHaveAttribute(
      "href",
      expect.stringContaining("0xabc123def456"),
    );
  });

  it("does not show loading spinner when not loading", () => {
    mockUseAgentActivity.mockReturnValue({
      events: mockEvents,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      enabled: true,
    });

    const { container } = render(<AgentActivityMonitor />);
    expect(container.querySelector(".animate-spin")).not.toBeInTheDocument();
  });
});
