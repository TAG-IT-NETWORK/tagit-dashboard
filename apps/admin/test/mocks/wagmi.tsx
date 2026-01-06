import { vi } from "vitest";
import React from "react";
import type { ReactNode } from "react";

// Mock account address
export const mockAccount = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as const;

// Mock wagmi hooks
export const mockUseAccount = vi.fn().mockReturnValue({
  address: mockAccount,
  isConnected: true,
  isConnecting: false,
  isDisconnected: false,
  isReconnecting: false,
  status: "connected",
});

export const mockUseConnect = vi.fn().mockReturnValue({
  connect: vi.fn(),
  connectors: [],
  isPending: false,
  isSuccess: false,
  isError: false,
});

export const mockUseDisconnect = vi.fn().mockReturnValue({
  disconnect: vi.fn(),
  isPending: false,
});

export const mockUseBalance = vi.fn().mockReturnValue({
  data: { value: BigInt("1000000000000000000"), decimals: 18, symbol: "ETH" },
  isLoading: false,
  isError: false,
});

export const mockUseReadContract = vi.fn().mockReturnValue({
  data: undefined,
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
});

export const mockUseWriteContract = vi.fn().mockReturnValue({
  writeContract: vi.fn(),
  writeContractAsync: vi.fn().mockResolvedValue("0xhash"),
  isPending: false,
  isSuccess: false,
  isError: false,
  data: undefined,
});

export const mockUseWaitForTransactionReceipt = vi.fn().mockReturnValue({
  data: undefined,
  isLoading: false,
  isSuccess: false,
  isError: false,
});

// Setup wagmi mocks
export function setupWagmiMocks() {
  vi.mock("wagmi", () => ({
    useAccount: mockUseAccount,
    useConnect: mockUseConnect,
    useDisconnect: mockUseDisconnect,
    useBalance: mockUseBalance,
    useReadContract: mockUseReadContract,
    useWriteContract: mockUseWriteContract,
    useWaitForTransactionReceipt: mockUseWaitForTransactionReceipt,
    useConfig: vi.fn().mockReturnValue({}),
    useChainId: vi.fn().mockReturnValue(11155420),
    WagmiProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  }));

  vi.mock("@rainbow-me/rainbowkit", () => ({
    ConnectButton: () => <button>Connect Wallet</button>,
    RainbowKitProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  }));

  vi.mock("@tanstack/react-query", () => ({
    QueryClient: vi.fn().mockImplementation(() => ({})),
    QueryClientProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
    useQuery: vi.fn().mockReturnValue({ data: undefined, isLoading: false }),
    useMutation: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
  }));
}

// Reset all mocks
export function resetWagmiMocks() {
  mockUseAccount.mockClear();
  mockUseConnect.mockClear();
  mockUseDisconnect.mockClear();
  mockUseBalance.mockClear();
  mockUseReadContract.mockClear();
  mockUseWriteContract.mockClear();
  mockUseWaitForTransactionReceipt.mockClear();
}

// Helper to set disconnected state
export function setDisconnectedState() {
  mockUseAccount.mockReturnValue({
    address: undefined,
    isConnected: false,
    isConnecting: false,
    isDisconnected: true,
    isReconnecting: false,
    status: "disconnected",
  });
}

// Helper to set connected state
export function setConnectedState(address: string = mockAccount) {
  mockUseAccount.mockReturnValue({
    address,
    isConnected: true,
    isConnecting: false,
    isDisconnected: false,
    isReconnecting: false,
    status: "connected",
  });
}
