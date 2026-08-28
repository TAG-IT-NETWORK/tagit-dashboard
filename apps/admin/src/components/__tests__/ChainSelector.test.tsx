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

// Mock @tagit/config. supportedChains still carries the retired mirrors —
// exactly the condition the selector must filter (META-T37): wagmi keeps
// recognising them, the header must not render badges for them.
vi.mock("@tagit/config", () => ({
  supportedChains: [
    { id: 421614, name: "Arbitrum Sepolia" },
    { id: 11155420, name: "OP Sepolia" },
    { id: 84532, name: "Base Sepolia" },
  ],
  getPrimaryChainId: vi.fn().mockReturnValue(84532),
  getChainRole: vi.fn((id: number) => (id === 84532 ? "primary" : "mirror")),
  isMultiChainEnabled: vi.fn().mockReturnValue(true),
}));

describe("ChainSelector", () => {
  beforeEach(() => {
    mockUseChainId.mockReturnValue(84532);
    mockUseSwitchChain.mockReturnValue({ switchChain: vi.fn() });
  });

  it("renders only Base Sepolia — the retired mirrors never appear", () => {
    render(<ChainSelector />);
    expect(screen.getByText("Base Sepolia")).toBeInTheDocument();
    expect(screen.queryByText("Arbitrum Sepolia")).not.toBeInTheDocument();
    expect(screen.queryByText("OP Sepolia")).not.toBeInTheDocument();
  });

  it("filters the retired chains even when supportedChains still lists them", () => {
    render(<ChainSelector />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("marks the active chain with primary styling", () => {
    mockUseChainId.mockReturnValue(84532);
    render(<ChainSelector />);
    const buttons = screen.getAllByRole("button");
    const baseButton = buttons.find((b) => b.textContent?.includes("Base Sepolia"));
    expect(baseButton).toHaveClass("bg-primary");
  });

  it("keeps the (Primary) role label and shows no (Mirror) badge", () => {
    render(<ChainSelector />);
    expect(screen.getByText("(Primary)")).toBeInTheDocument();
    expect(screen.queryByText("(Mirror)")).not.toBeInTheDocument();
  });

  it("calls switchChain when the Base Sepolia button is clicked", async () => {
    const mockSwitchChain = vi.fn();
    mockUseSwitchChain.mockReturnValue({ switchChain: mockSwitchChain });
    const { getByText } = render(<ChainSelector />);
    const baseButton = getByText("Base Sepolia").closest("button")!;
    baseButton.click();
    expect(mockSwitchChain).toHaveBeenCalledWith({ chainId: 84532 });
  });
});
