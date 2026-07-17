import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// ─── Mocks ──────────────────────────────────────────────────────────────

const mockUseAccount = vi.fn();
const mockUseBatchMint = vi.fn();
const mockUseBatchBind = vi.fn();
const mockUseBatchActivate = vi.fn();
const mockUseChainId = vi.fn();
const mockUseNfcBridge = vi.fn();

vi.mock("@tagit/contracts", () => ({
  useAccount: () => mockUseAccount(),
  useBatchMint: () => mockUseBatchMint(),
  useBatchBind: () => mockUseBatchBind(),
  useBatchActivate: () => mockUseBatchActivate(),
  getExplorerTxUrl: (chainId: number, hash: string) =>
    `https://explorer.example/${chainId}/${hash}`,
  parseContractError: (error: Error) => ({
    message: error.message,
    code: "UNKNOWN",
    isUserRejection: false,
    isCapabilityError: false,
    isNetworkError: false,
  }),
}));

vi.mock("wagmi", () => ({
  useChainId: () => mockUseChainId(),
}));

vi.mock("@/lib/nfc-bridge", () => ({
  useNfcBridge: () => mockUseNfcBridge(),
}));

vi.mock("@/components/wagmi-guard", () => ({
  WagmiGuard: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

import { AssemblyLineConsole } from "../assembly-line-console";

const CONNECTED_ADDRESS = "0x458B4d0c3a55006965Fd13D6af7B8509De51Cb3D";

function defaultWriteHookReturn() {
  return {
    hash: undefined,
    isPending: false,
    isConfirming: false,
    isSuccess: false,
    error: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAccount.mockReturnValue({ address: CONNECTED_ADDRESS });
  mockUseChainId.mockReturnValue(84532);
  mockUseNfcBridge.mockReturnValue({
    wsConnected: false,
    readerConnected: false,
    readerName: null,
    card: null,
    bridgeVersion: null,
    error: "Cannot reach bridge — is tagit-nfc-bridge running?",
    config: { url: "ws://127.0.0.1:8237", token: "" },
    ready: false,
    request: vi.fn(),
    updateConfig: vi.fn(),
    reconnect: vi.fn(),
  });
  mockUseBatchMint.mockReturnValue({
    ...defaultWriteHookReturn(),
    batchMint: vi.fn(),
    tokenIds: [],
    receipt: undefined,
  });
  mockUseBatchBind.mockReturnValue({ ...defaultWriteHookReturn(), batchBind: vi.fn() });
  mockUseBatchActivate.mockReturnValue({ ...defaultWriteHookReturn(), batchActivate: vi.fn() });
});

describe("AssemblyLineConsole", () => {
  it("renders the page header and run configuration", () => {
    render(<AssemblyLineConsole />);
    expect(screen.getByText("Assembly Line")).toBeInTheDocument();
    expect(screen.getByText("Run configuration")).toBeInTheDocument();
    expect(screen.getByLabelText("Recipient address")).toBeInTheDocument();
  });

  it("pre-fills the recipient address from the connected wallet", () => {
    render(<AssemblyLineConsole />);
    expect(screen.getByLabelText("Recipient address")).toHaveValue(CONNECTED_ADDRESS);
  });

  it("shows the empty-queue prompt and a 0/100 counter before any taps", () => {
    render(<AssemblyLineConsole />);
    expect(screen.getByText("Tap a chip on the reader to begin.")).toBeInTheDocument();
    expect(screen.getByText("0/100 chips")).toBeInTheDocument();
  });

  it("disables the submit button while the queue is empty", () => {
    render(<AssemblyLineConsole />);
    expect(screen.getByRole("button", { name: /mint & bind 0 chips/i })).toBeDisabled();
  });

  it("shows the bridge-not-connected state when the bridge is unreachable", () => {
    render(<AssemblyLineConsole />);
    expect(screen.getByText("Bridge not connected")).toBeInTheDocument();
  });

  it("both program-on-tap and activate-after-bind toggles default to ON", () => {
    render(<AssemblyLineConsole />);
    expect(screen.getByLabelText("Program SDM on tap")).toBeChecked();
    expect(screen.getByLabelText("Activate after bind")).toBeChecked();
  });

  it("does not render the run-status stepper before a submit", () => {
    render(<AssemblyLineConsole />);
    expect(screen.queryByText("Run status")).not.toBeInTheDocument();
  });
});
