import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChainSelector } from "../chain-selector";

// Mock wagmi hooks
const mockUseChainId = vi.fn();
const mockUseSwitchChain = vi.fn();

vi.mock("wagmi", () => ({
  useChainId: () => mockUseChainId(),
  useSwitchChain: () => mockUseSwitchChain(),
}));

// Mock @tagit/config
vi.mock("@tagit/config", () => ({
  supportedChains: [
    { id: 421614, name: "Arbitrum Sepolia" },
    { id: 11155420, name: "OP Sepolia" },
    { id: 84532, name: "Base Sepolia" },
  ],
  getPrimaryChainId: vi.fn().mockReturnValue(421614),
  getChainRole: vi.fn((id: number) => (id === 421614 ? "primary" : "mirror")),
  isMultiChainEnabled: vi.fn().mockReturnValue(true),
}));

describe("ChainSelector", () => {
  beforeEach(() => {
    mockUseChainId.mockReturnValue(421614);
    mockUseSwitchChain.mockReturnValue({ switchChain: vi.fn() });
  });

  it("renders all three supported chains", () => {
    render(<ChainSelector />);
    expect(screen.getByText("Arbitrum Sepolia")).toBeInTheDocument();
    expect(screen.getByText("OP Sepolia")).toBeInTheDocument();
    expect(screen.getByText("Base Sepolia")).toBeInTheDocument();
  });

  it("marks the active chain with primary styling", () => {
    mockUseChainId.mockReturnValue(421614);
    render(<ChainSelector />);
    const buttons = screen.getAllByRole("button");
    const arbButton = buttons.find((b) => b.textContent?.includes("Arbitrum Sepolia"));
    expect(arbButton).toHaveClass("bg-primary");
  });

  it("shows primary/mirror role labels when multi-chain is enabled", () => {
    render(<ChainSelector />);
    expect(screen.getByText("(Primary)")).toBeInTheDocument();
  });

  it("renders Base Sepolia with correct chain ID 84532", () => {
    const { getByText } = render(<ChainSelector />);
    expect(getByText("Base Sepolia")).toBeInTheDocument();
  });

  it("calls switchChain when a chain button is clicked", async () => {
    const mockSwitchChain = vi.fn();
    mockUseSwitchChain.mockReturnValue({ switchChain: mockSwitchChain });
    const { getByText } = render(<ChainSelector />);
    const baseButton = getByText("Base Sepolia").closest("button")!;
    baseButton.click();
    expect(mockSwitchChain).toHaveBeenCalledWith({ chainId: 84532 });
  });
});
