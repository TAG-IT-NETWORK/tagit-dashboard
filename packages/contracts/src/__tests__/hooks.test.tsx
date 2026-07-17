import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { keccak256, toBytes, toHex } from "viem";

// Mock all wagmi hooks used by ../hooks. Tests drive the return values to verify
// our hooks' data transforms — no real chain/provider involved.
const useReadContract = vi.fn();
const usePublicClient = vi.fn();
const useWriteContract = vi.fn();
const useWaitForTransactionReceipt = vi.fn();
const useWalletClient = vi.fn();
vi.mock("wagmi", () => ({
  useChainId: () => 84532, // Base Sepolia
  useReadContract: (args: unknown) => useReadContract(args),
  useReadContracts: vi.fn(),
  useWriteContract: () => useWriteContract(),
  useWaitForTransactionReceipt: (args: unknown) => useWaitForTransactionReceipt(args),
  useWalletClient: () => useWalletClient(),
  usePublicClient: () => usePublicClient(),
}));

import {
  useResolveApprovalStatus,
  useCapabilityGate,
  useResolveApprovers,
  useBatchMint,
  useBatchBind,
  useBatchActivate,
  useBatchFlag,
} from "../hooks";
import { Capabilities } from "../abis/TAGITAccess";
import { computeBatchBindDigest } from "../batch-utils";

const RECIPIENT = "0x2222222222222222222222222222222222222222";

// Default write-hook mocks — individual tests override via mockReturnValue
// where they need custom receipts/signatures. mockWriteContractFn/mockSignMessage
// are the inner spies so tests can assert on call args.
const mockWriteContractFn = vi.fn();
const mockSignMessage = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  useWriteContract.mockReturnValue({
    writeContract: mockWriteContractFn,
    data: undefined,
    isPending: false,
    error: null,
  });
  useWaitForTransactionReceipt.mockReturnValue({
    isLoading: false,
    isSuccess: false,
    data: undefined,
  });
  useWalletClient.mockReturnValue({ data: { signMessage: mockSignMessage } });
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

// ─── Batch lifecycle (Assembly Line) ────────────────────────────────────────

const ASSET_MINTED_TOPIC = keccak256(toBytes("AssetMinted(uint256,address,bytes32)"));
function tokenTopic(tokenId: bigint): `0x${string}` {
  return `0x${tokenId.toString(16).padStart(64, "0")}` as `0x${string}`;
}

describe("useBatchMint", () => {
  it("calls writeContract with functionName batchMint and the recipients/metadata arrays", () => {
    const { result } = renderHook(() => useBatchMint());
    const recipients = [RECIPIENT, RECIPIENT] as `0x${string}`[];
    const metadata = [
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000000000000000000000000000000",
    ] as `0x${string}`[];

    result.current.batchMint(recipients, metadata);

    expect(mockWriteContractFn).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "batchMint",
        args: [recipients, metadata],
      }),
    );
  });

  it("returns an empty tokenIds array when no receipt has landed yet", () => {
    const { result } = renderHook(() => useBatchMint());
    expect(result.current.tokenIds).toEqual([]);
  });

  it("parses tokenIds from AssetMinted logs once the receipt lands", () => {
    useWaitForTransactionReceipt.mockReturnValue({
      isLoading: false,
      isSuccess: true,
      data: {
        logs: [
          { topics: [ASSET_MINTED_TOPIC, tokenTopic(10n), tokenTopic(0n)] },
          { topics: [ASSET_MINTED_TOPIC, tokenTopic(11n), tokenTopic(0n)] },
        ],
      },
    });
    const { result } = renderHook(() => useBatchMint());
    expect(result.current.tokenIds).toEqual([10n, 11n]);
    expect(result.current.isSuccess).toBe(true);
  });
});

describe("useBatchBind", () => {
  it("signs the batch digest raw and calls writeContract with batchBind + matching args", async () => {
    mockSignMessage.mockResolvedValue("0xdeadbeef");
    const { result } = renderHook(() => useBatchBind());

    const tokenIds = [1n, 2n];
    const tagHashes = [keccak256(toBytes("tag1")), keccak256(toBytes("tag2"))];

    await act(async () => {
      await result.current.batchBind(tokenIds, tagHashes);
    });

    // The digest signMessage was called with must equal what the pure digest
    // function computes for this exact batch (contract address comes from
    // getContractsForChain(84532) in this test env).
    const expectedDigest = computeBatchBindDigest({
      chainId: 84532,
      contractAddress: mockWriteContractFn.mock.calls[0][0].address,
      tokenIds,
      tagHashes,
      challengeResponses: [toHex(toBytes("challenge1")), toHex(toBytes("challenge2"))],
    });
    expect(mockSignMessage).toHaveBeenCalledWith({
      message: { raw: toBytes(expectedDigest) },
    });

    expect(mockWriteContractFn).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "batchBind",
        args: [
          tokenIds,
          tagHashes,
          [toHex(toBytes("challenge1")), toHex(toBytes("challenge2"))],
          "0xdeadbeef",
        ],
      }),
    );
  });

  it("does nothing when no wallet client is connected", async () => {
    useWalletClient.mockReturnValue({ data: undefined });
    const { result } = renderHook(() => useBatchBind());

    await act(async () => {
      await result.current.batchBind([1n], [keccak256(toBytes("tag1"))]);
    });

    expect(mockWriteContractFn).not.toHaveBeenCalled();
  });
});

describe("useBatchActivate", () => {
  it("calls writeContract with functionName batchActivate and the tokenIds array", () => {
    const { result } = renderHook(() => useBatchActivate());
    result.current.batchActivate([1n, 2n, 3n]);
    expect(mockWriteContractFn).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "batchActivate",
        args: [[1n, 2n, 3n]],
      }),
    );
  });
});

describe("useBatchFlag", () => {
  it("calls writeContract with functionName batchFlag and the tokenIds array", () => {
    const { result } = renderHook(() => useBatchFlag());
    result.current.batchFlag([4n, 5n]);
    expect(mockWriteContractFn).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "batchFlag",
        args: [[4n, 5n]],
      }),
    );
  });
});
