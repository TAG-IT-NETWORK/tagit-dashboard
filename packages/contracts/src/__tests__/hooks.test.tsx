import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

// Mock all wagmi hooks used by ../hooks. Tests drive the return values to verify
// our hooks' data transforms — no real chain/provider involved.
const useReadContract = vi.fn();
const usePublicClient = vi.fn();
vi.mock("wagmi", () => ({
  useChainId: () => 84532, // Base Sepolia
  useReadContract: (args: unknown) => useReadContract(args),
  useReadContracts: vi.fn(),
  useWriteContract: () => ({
    writeContract: vi.fn(),
    data: undefined,
    isPending: false,
    error: null,
  }),
  useWaitForTransactionReceipt: () => ({ isLoading: false, isSuccess: false }),
  useWalletClient: () => ({ data: undefined }),
  usePublicClient: () => usePublicClient(),
}));

import { useResolveApprovalStatus, useCapabilityGate, useResolveApprovers } from "../hooks";
import { Capabilities } from "../abis/TAGITAccess";

const RECIPIENT = "0x2222222222222222222222222222222222222222";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useResolveApprovalStatus", () => {
  it("maps the contract tuple to approvalCount/recipient/quorumReached", () => {
    useReadContract.mockReturnValue({
      data: [2n, RECIPIENT, true],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const { result } = renderHook(() => useResolveApprovalStatus(5n));
    expect(result.current.approvalCount).toBe(2n);
    expect(result.current.recipient).toBe(RECIPIENT);
    expect(result.current.quorumReached).toBe(true);
  });

  it("defaults safely when data is undefined", () => {
    useReadContract.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });
    const { result } = renderHook(() => useResolveApprovalStatus(5n));
    expect(result.current.approvalCount).toBeUndefined();
    expect(result.current.recipient).toBeUndefined();
    expect(result.current.quorumReached).toBe(false);
  });
});

describe("useCapabilityGate", () => {
  it("passes the capability as a uint256 bigint and returns true when granted", () => {
    useReadContract.mockReturnValue({
      data: true,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const addr = "0x458B4d0c3a55006965Fd13D6af7B8509De51Cb3D" as `0x${string}`;
    const { result } = renderHook(() => useCapabilityGate(addr, Capabilities.RESOLVER));

    expect(result.current.hasCapability).toBe(true);
    // critical regression guard: capability arg must be a bigint (uint256), not the bytes32 hash
    expect(useReadContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "hasCapability",
        args: [addr, BigInt(Capabilities.RESOLVER)],
      }),
    );
  });

  it("returns false when the read is not strictly true", () => {
    useReadContract.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const addr = "0x458B4d0c3a55006965Fd13D6af7B8509De51Cb3D" as `0x${string}`;
    const { result } = renderHook(() => useCapabilityGate(addr, Capabilities.RESOLVER));
    expect(result.current.hasCapability).toBe(false);
  });
});

describe("useResolveApprovers", () => {
  it("returns the ordered approver addresses from ResolveApproved logs", async () => {
    const agent = "0x8F6C12120d3D3317209D78573d3388Ba498672De";
    const human = "0x458B4d0c3a55006965Fd13D6af7B8509De51Cb3D";
    usePublicClient.mockReturnValue({
      getBlockNumber: vi.fn().mockResolvedValue(100000n),
      getLogs: vi
        .fn()
        .mockResolvedValue([{ args: { approver: agent } }, { args: { approver: human } }]),
    });
    const { result } = renderHook(() => useResolveApprovers(5n));
    await waitFor(() => expect(result.current.approvers).toHaveLength(2));
    expect(result.current.approvers).toEqual([agent, human]);
  });

  it("returns [] when the RPC rejects the log query", async () => {
    usePublicClient.mockReturnValue({
      getBlockNumber: vi.fn().mockResolvedValue(100000n),
      getLogs: vi.fn().mockRejectedValue(new Error("query exceeds max block range")),
    });
    const { result } = renderHook(() => useResolveApprovers(5n));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.approvers).toEqual([]);
  });
});
