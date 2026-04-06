"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import {
  usePublicClient,
  useChainId,
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatEther, parseEther } from "viem";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Badge,
  Input,
  Label,
  AddressBadge,
  useToast,
} from "@tagit/ui";
import { getExplorerAddressUrl } from "@tagit/contracts";
import {
  Coins,
  ExternalLink,
  AlertCircle,
  Loader2,
  RefreshCw,
  Lock,
  Unlock,
  Clock,
  ArrowRightLeft,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";

// ── Constants ──

const BASE_SEPOLIA_CHAIN_ID = 84532;

const CONTRACTS = {
  TAGITToken: "0x5f98B83cD7Aef769cc51D2FB739BA49D561170DE" as `0x${string}`,
  wTAG: "0x746385e59aCB225779D64e74200e464a3f1C23d0" as `0x${string}`,
  wTAGStaking: "0xBd4c4848C9fF09B7955a193E3b96456344D9acBe" as `0x${string}`,
} as const;

const EXPLORER_BASE = "https://sepolia.basescan.org";

// ── ABIs ──

const TAG_ABI = [
  {
    name: "name",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "totalSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const WTAG_ABI = [
  {
    name: "name",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "totalSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "cap",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "tgeTimestamp",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "isLocked",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "lockoutEnd",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "wrap",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    name: "unwrap",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const STAKING_ABI = [
  {
    name: "depositBalance",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "totalDeposited",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "pendingRewards",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "deposit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    name: "claimRewards",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    name: "paused",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

// ── Types ──

interface TokenomicsData {
  tagTotalSupply: bigint;
  wtagTotalSupply: bigint;
  wtagCap: bigint;
  tgeTimestamp: bigint;
  isLocked: boolean;
  lockoutEnd: bigint;
  // per-user
  tagBalance: bigint;
  wtagBalance: bigint;
  stakedBalance: bigint;
  pendingRewards: bigint;
  totalStaked: bigint;
  stakingPaused: boolean;
}

// ── Helpers ──

function formatTokenAmount(value: bigint, symbol: string, compact = false): string {
  const num = parseFloat(formatEther(value));
  if (compact) {
    if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B ${symbol}`;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M ${symbol}`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K ${symbol}`;
    return `${num.toFixed(2)} ${symbol}`;
  }
  return `${num.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${symbol}`;
}

function formatCountdown(targetTs: bigint): string {
  const now = Math.floor(Date.now() / 1000);
  const target = Number(targetTs);
  const diff = target - now;
  if (diff <= 0) return "Unlocked";
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatTimestamp(ts: bigint): string {
  if (ts === 0n) return "Not set";
  return new Date(Number(ts) * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function explorerLink(address: string): string {
  return `${EXPLORER_BASE}/address/${address}`;
}

// ── Sub-components ──

function StatCard({
  title,
  value,
  subtitle,
  icon,
  accentClass = "",
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  accentClass?: string;
}) {
  return (
    <Card className={`border ${accentClass || "border-border"}`}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-xl font-bold mt-1 font-mono truncate">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className="text-muted-foreground shrink-0">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

interface TransactionStatusProps {
  hash: `0x${string}` | undefined;
  isPending: boolean;
  isConfirming: boolean;
  isConfirmed: boolean;
  isError: boolean;
  error: Error | null;
}

function TransactionStatus({
  hash,
  isPending,
  isConfirming,
  isConfirmed,
  isError,
  error,
}: TransactionStatusProps) {
  if (!hash && !isPending && !isError) return null;

  return (
    <div
      className={`mt-3 rounded-md border px-3 py-2 text-xs flex items-start gap-2 ${
        isError
          ? "border-destructive/50 bg-destructive/10 text-destructive"
          : isConfirmed
            ? "border-green-500/50 bg-green-500/10 text-green-400"
            : "border-border bg-muted text-muted-foreground"
      }`}
    >
      {isError ? (
        <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      ) : isConfirmed ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-green-400" />
      ) : (
        <Loader2 className="h-3.5 w-3.5 shrink-0 mt-0.5 animate-spin" />
      )}
      <div className="min-w-0">
        {isPending && <span>Confirm in wallet...</span>}
        {isConfirming && hash && (
          <span>
            Confirming{" "}
            <a
              href={`${EXPLORER_BASE}/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-mono"
            >
              {hash.slice(0, 10)}...
            </a>
          </span>
        )}
        {isConfirmed && <span>Transaction confirmed.</span>}
        {isError && (
          <span className="break-words">
            {error?.message?.split("\n")[0] ?? "Transaction failed"}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Page ──

export default function TokenomicsPage() {
  const chainId = useChainId();
  const client = usePublicClient();
  const { address: userAddress, isConnected } = useAccount();
  const { toast } = useToast();

  const [data, setData] = useState<TokenomicsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Wrap/Unwrap tab state
  const [activeTab, setActiveTab] = useState<"wrap" | "unwrap">("wrap");
  const [wrapAmount, setWrapAmount] = useState("");
  const [unwrapAmount, setUnwrapAmount] = useState("");

  // Staking amounts
  const [stakeAmount, setStakeAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const isBaseSepolia = chainId === BASE_SEPOLIA_CHAIN_ID;

  // ── Write contract hooks ──

  const {
    writeContract: writeApproveTag,
    data: approveTagHash,
    isPending: approveTagPending,
    isError: approveTagError,
    error: approveTagErr,
    reset: resetApproveTag,
  } = useWriteContract();

  const { isLoading: approveTagConfirming, isSuccess: approveTagConfirmed } =
    useWaitForTransactionReceipt({ hash: approveTagHash });

  const {
    writeContract: writeWrap,
    data: wrapHash,
    isPending: wrapPending,
    isError: wrapError,
    error: wrapErr,
    reset: resetWrap,
  } = useWriteContract();

  const { isLoading: wrapConfirming, isSuccess: wrapConfirmed } = useWaitForTransactionReceipt({
    hash: wrapHash,
  });

  const {
    writeContract: writeApproveWtag,
    data: approveWtagHash,
    isPending: approveWtagPending,
    isError: approveWtagError,
    error: approveWtagErr,
    reset: resetApproveWtag,
  } = useWriteContract();

  const { isLoading: approveWtagConfirming, isSuccess: approveWtagConfirmed } =
    useWaitForTransactionReceipt({ hash: approveWtagHash });

  const {
    writeContract: writeUnwrap,
    data: unwrapHash,
    isPending: unwrapPending,
    isError: unwrapError,
    error: unwrapErr,
    reset: resetUnwrap,
  } = useWriteContract();

  const { isLoading: unwrapConfirming, isSuccess: unwrapConfirmed } = useWaitForTransactionReceipt({
    hash: unwrapHash,
  });

  const {
    writeContract: writeStake,
    data: stakeHash,
    isPending: stakePending,
    isError: stakeError,
    error: stakeErr,
    reset: resetStake,
  } = useWriteContract();

  const { isLoading: stakeConfirming, isSuccess: stakeConfirmed } = useWaitForTransactionReceipt({
    hash: stakeHash,
  });

  const {
    writeContract: writeWithdraw,
    data: withdrawHash,
    isPending: withdrawPending,
    isError: withdrawError,
    error: withdrawErr,
    reset: resetWithdraw,
  } = useWriteContract();

  const { isLoading: withdrawConfirming, isSuccess: withdrawConfirmed } =
    useWaitForTransactionReceipt({ hash: withdrawHash });

  const {
    writeContract: writeClaim,
    data: claimHash,
    isPending: claimPending,
    isError: claimError,
    error: claimErr,
    reset: resetClaim,
  } = useWriteContract();

  const { isLoading: claimConfirming, isSuccess: claimConfirmed } = useWaitForTransactionReceipt({
    hash: claimHash,
  });

  // ── Data fetching ──

  const fetchData = useCallback(async () => {
    if (!client || !isBaseSepolia) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const globalReads = await Promise.all([
        client.readContract({
          address: CONTRACTS.TAGITToken,
          abi: TAG_ABI,
          functionName: "totalSupply",
        }),
        client.readContract({
          address: CONTRACTS.wTAG,
          abi: WTAG_ABI,
          functionName: "totalSupply",
        }),
        client.readContract({ address: CONTRACTS.wTAG, abi: WTAG_ABI, functionName: "cap" }),
        client.readContract({
          address: CONTRACTS.wTAG,
          abi: WTAG_ABI,
          functionName: "tgeTimestamp",
        }),
        client.readContract({ address: CONTRACTS.wTAG, abi: WTAG_ABI, functionName: "isLocked" }),
        client.readContract({ address: CONTRACTS.wTAG, abi: WTAG_ABI, functionName: "lockoutEnd" }),
        client.readContract({
          address: CONTRACTS.wTAGStaking,
          abi: STAKING_ABI,
          functionName: "totalDeposited",
        }),
        client.readContract({
          address: CONTRACTS.wTAGStaking,
          abi: STAKING_ABI,
          functionName: "paused",
        }),
      ]);

      const [
        tagTotalSupply,
        wtagTotalSupply,
        wtagCap,
        tgeTimestamp,
        isLocked,
        lockoutEnd,
        totalStaked,
        stakingPaused,
      ] = globalReads as [bigint, bigint, bigint, bigint, boolean, bigint, bigint, boolean];

      let tagBalance = 0n;
      let wtagBalance = 0n;
      let stakedBalance = 0n;
      let pendingRewards = 0n;

      if (userAddress) {
        const userReads = await Promise.all([
          client.readContract({
            address: CONTRACTS.TAGITToken,
            abi: TAG_ABI,
            functionName: "balanceOf",
            args: [userAddress],
          }),
          client.readContract({
            address: CONTRACTS.wTAG,
            abi: WTAG_ABI,
            functionName: "balanceOf",
            args: [userAddress],
          }),
          client
            .readContract({
              address: CONTRACTS.wTAGStaking,
              abi: STAKING_ABI,
              functionName: "depositBalance",
              args: [userAddress],
            })
            .catch(() => 0n),
          client
            .readContract({
              address: CONTRACTS.wTAGStaking,
              abi: STAKING_ABI,
              functionName: "pendingRewards",
              args: [userAddress],
            })
            .catch(() => 0n),
        ]);
        [tagBalance, wtagBalance, stakedBalance, pendingRewards] = userReads as [
          bigint,
          bigint,
          bigint,
          bigint,
        ];
      }

      setData({
        tagTotalSupply,
        wtagTotalSupply,
        wtagCap,
        tgeTimestamp,
        isLocked,
        lockoutEnd,
        tagBalance,
        wtagBalance,
        stakedBalance,
        pendingRewards,
        totalStaked,
        stakingPaused,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch tokenomics data");
    } finally {
      setLoading(false);
    }
  }, [client, isBaseSepolia, userAddress]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refresh after confirmed transactions
  useEffect(() => {
    if (wrapConfirmed || unwrapConfirmed || stakeConfirmed || withdrawConfirmed || claimConfirmed) {
      fetchData();
    }
  }, [
    wrapConfirmed,
    unwrapConfirmed,
    stakeConfirmed,
    withdrawConfirmed,
    claimConfirmed,
    fetchData,
  ]);

  // Toast on confirmations
  useEffect(() => {
    if (wrapConfirmed)
      toast({
        title: "Wrap confirmed",
        description: `${wrapAmount} TAG wrapped to wTAG`,
        variant: "success",
      });
  }, [wrapConfirmed]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (unwrapConfirmed)
      toast({
        title: "Unwrap confirmed",
        description: `${unwrapAmount} wTAG unwrapped`,
        variant: "success",
      });
  }, [unwrapConfirmed]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (stakeConfirmed)
      toast({
        title: "Stake confirmed",
        description: `${stakeAmount} wTAG staked`,
        variant: "success",
      });
  }, [stakeConfirmed]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (withdrawConfirmed)
      toast({
        title: "Withdraw confirmed",
        description: `${withdrawAmount} wTAG withdrawn`,
        variant: "success",
      });
  }, [withdrawConfirmed]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (claimConfirmed) toast({ title: "Rewards claimed", variant: "success" });
  }, [claimConfirmed]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Action handlers ──

  function handleApproveForWrap() {
    if (!wrapAmount) return;
    resetApproveTag();
    try {
      const amount = parseEther(wrapAmount);
      writeApproveTag({
        address: CONTRACTS.TAGITToken,
        abi: TAG_ABI,
        functionName: "approve",
        args: [CONTRACTS.wTAG, amount],
      });
    } catch {
      toast({ title: "Invalid amount", variant: "error" });
    }
  }

  function handleWrap() {
    if (!wrapAmount) return;
    resetWrap();
    try {
      writeWrap({
        address: CONTRACTS.wTAG,
        abi: WTAG_ABI,
        functionName: "wrap",
        args: [parseEther(wrapAmount)],
      });
    } catch {
      toast({ title: "Invalid amount", variant: "error" });
    }
  }

  function handleApproveForStake() {
    if (!stakeAmount) return;
    resetApproveWtag();
    try {
      const amount = parseEther(stakeAmount);
      writeApproveWtag({
        address: CONTRACTS.wTAG,
        abi: WTAG_ABI,
        functionName: "approve",
        args: [CONTRACTS.wTAGStaking, amount],
      });
    } catch {
      toast({ title: "Invalid amount", variant: "error" });
    }
  }

  function handleUnwrap() {
    if (!unwrapAmount) return;
    resetUnwrap();
    try {
      writeUnwrap({
        address: CONTRACTS.wTAG,
        abi: WTAG_ABI,
        functionName: "unwrap",
        args: [parseEther(unwrapAmount)],
      });
    } catch {
      toast({ title: "Invalid amount", variant: "error" });
    }
  }

  function handleStake() {
    if (!stakeAmount) return;
    resetStake();
    try {
      writeStake({
        address: CONTRACTS.wTAGStaking,
        abi: STAKING_ABI,
        functionName: "deposit",
        args: [parseEther(stakeAmount)],
      });
    } catch {
      toast({ title: "Invalid amount", variant: "error" });
    }
  }

  function handleWithdraw() {
    if (!withdrawAmount) return;
    resetWithdraw();
    try {
      writeWithdraw({
        address: CONTRACTS.wTAGStaking,
        abi: STAKING_ABI,
        functionName: "withdraw",
        args: [parseEther(withdrawAmount)],
      });
    } catch {
      toast({ title: "Invalid amount", variant: "error" });
    }
  }

  function handleClaim() {
    resetClaim();
    writeClaim({
      address: CONTRACTS.wTAGStaking,
      abi: STAKING_ABI,
      functionName: "claimRewards",
    });
  }

  // ── Chain mismatch ──

  if (!isBaseSepolia) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Coins className="h-6 w-6 text-primary" />
              wTAG Tokenomics
            </h1>
            <p className="text-muted-foreground">wTAG token management and staking</p>
          </div>
        </div>
        <Card className="border-orange-500/50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-orange-400">Wrong Network</p>
                <p className="text-sm text-muted-foreground mt-1">
                  wTAG is available on Base Sepolia only. Please switch chains.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Currently connected to chain ID: <span className="font-mono">{chainId}</span>.
                  Required: <span className="font-mono">{BASE_SEPOLIA_CHAIN_ID}</span> (Base
                  Sepolia).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const lockoutActive = data?.isLocked ?? false;
  const stakingBlocked = lockoutActive || (data?.stakingPaused ?? false);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Coins className="h-6 w-6 text-primary" />
            wTAG Tokenomics
          </h1>
          <p className="text-muted-foreground">wTAG token management — wrap, unwrap, and stake</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="font-mono text-blue-400 border-blue-400/40 bg-blue-500/10"
          >
            Base Sepolia
          </Badge>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && data && (
        <>
          {/* ── Token Overview Cards ── */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="TAG Total Supply"
              value={formatTokenAmount(data.tagTotalSupply, "TAG", true)}
              subtitle="TAGITToken (ERC-20)"
              icon={<Coins className="h-5 w-5" />}
              accentClass="border-primary/40"
            />
            <StatCard
              title="wTAG Supply"
              value={formatTokenAmount(data.wtagTotalSupply, "wTAG", true)}
              subtitle={`Cap: ${formatTokenAmount(data.wtagCap, "wTAG", true)}`}
              icon={<TrendingUp className="h-5 w-5 text-violet-400" />}
              accentClass="border-violet-500/40"
            />
            <StatCard
              title="wTAG Cap"
              value={
                data.tagTotalSupply > 0n
                  ? `${((Number(formatEther(data.wtagCap)) / Number(formatEther(data.tagTotalSupply))) * 100).toFixed(2)}% of TAG`
                  : "—"
              }
              subtitle={formatTokenAmount(data.wtagCap, "wTAG", true)}
              icon={<TrendingUp className="h-5 w-5 text-orange-400" />}
              accentClass="border-orange-500/40"
            />
            <Card
              className={`border ${lockoutActive ? "border-red-500/40" : "border-green-500/40"}`}
            >
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">Lockout Status</p>
                    <div className="flex items-center gap-2 mt-1">
                      {lockoutActive ? (
                        <>
                          <Lock className="h-4 w-4 text-red-400 shrink-0" />
                          <span className="text-xl font-bold text-red-400">Locked</span>
                        </>
                      ) : (
                        <>
                          <Unlock className="h-4 w-4 text-green-400 shrink-0" />
                          <span className="text-xl font-bold text-green-400">Unlocked</span>
                        </>
                      )}
                    </div>
                    {lockoutActive && data.lockoutEnd > 0n && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Unlocks in {formatCountdown(data.lockoutEnd)}
                      </p>
                    )}
                  </div>
                  {lockoutActive ? (
                    <Lock className="h-5 w-5 text-red-400 shrink-0" />
                  ) : (
                    <Unlock className="h-5 w-5 text-green-400 shrink-0" />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Your Balances ── */}
          {isConnected && userAddress ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Your Balances</CardTitle>
                <CardDescription>
                  <AddressBadge address={userAddress} chainId={chainId} truncate />
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border p-4 space-y-1">
                    <p className="text-xs text-muted-foreground">TAG Balance</p>
                    <p className="font-mono font-bold">
                      {formatTokenAmount(data.tagBalance, "TAG")}
                    </p>
                  </div>
                  <div className="rounded-lg border p-4 space-y-1">
                    <p className="text-xs text-muted-foreground">wTAG Balance</p>
                    <p className="font-mono font-bold">
                      {formatTokenAmount(data.wtagBalance, "wTAG")}
                    </p>
                  </div>
                  <div className="rounded-lg border p-4 space-y-1">
                    <p className="text-xs text-muted-foreground">Staked wTAG</p>
                    <p className="font-mono font-bold">
                      {formatTokenAmount(data.stakedBalance, "wTAG")}
                    </p>
                  </div>
                  <div className="rounded-lg border p-4 space-y-1">
                    <p className="text-xs text-muted-foreground">Pending Rewards</p>
                    <p className="font-mono font-bold text-green-400">
                      {formatTokenAmount(data.pendingRewards, "wTAG")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Total value:{" "}
                      {formatTokenAmount(data.wtagBalance + data.stakedBalance, "wTAG")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-muted">
              <CardContent className="pt-6 text-center text-sm text-muted-foreground">
                Connect your wallet to see your balances.
              </CardContent>
            </Card>
          )}

          {/* ── Wrap / Unwrap ── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ArrowRightLeft className="h-4 w-4" />
                Wrap / Unwrap
              </CardTitle>
              <CardDescription>
                Convert between TAG and wTAG. Wrapping requires an approve step first.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Tabs */}
              <div className="flex gap-1 rounded-lg border p-1 w-fit">
                <button
                  onClick={() => setActiveTab("wrap")}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    activeTab === "wrap"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Wrap TAG → wTAG
                </button>
                <button
                  onClick={() => setActiveTab("unwrap")}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    activeTab === "unwrap"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Unwrap wTAG → TAG
                </button>
              </div>

              {/* Lockout warning */}
              {lockoutActive && (
                <div className="flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  <Lock className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Wrapping is disabled during the lockout period. Unlocks in{" "}
                    <span className="font-mono font-medium">
                      {formatCountdown(data.lockoutEnd)}
                    </span>{" "}
                    ({formatTimestamp(data.lockoutEnd)}).
                  </span>
                </div>
              )}

              {activeTab === "wrap" && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="wrap-amount">Amount (TAG)</Label>
                    <div className="flex gap-2">
                      <Input
                        id="wrap-amount"
                        type="number"
                        placeholder="0.00"
                        value={wrapAmount}
                        onChange={(e) => setWrapAmount(e.target.value)}
                        disabled={lockoutActive || !isConnected}
                        min="0"
                        step="any"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={lockoutActive || !isConnected || data.tagBalance === 0n}
                        onClick={() => setWrapAmount(formatEther(data.tagBalance))}
                      >
                        Max
                      </Button>
                    </div>
                  </div>

                  {/* Step 1: Approve */}
                  <div className="rounded-lg border p-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Step 1: Approve TAG spend
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        lockoutActive ||
                        !isConnected ||
                        !wrapAmount ||
                        approveTagPending ||
                        approveTagConfirming
                      }
                      onClick={handleApproveForWrap}
                      className="w-full"
                    >
                      {approveTagPending || approveTagConfirming ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : approveTagConfirmed ? (
                        <CheckCircle2 className="h-4 w-4 mr-2 text-green-400" />
                      ) : null}
                      {approveTagConfirmed ? "Approved" : "Approve TAG"}
                    </Button>
                    <TransactionStatus
                      hash={approveTagHash}
                      isPending={approveTagPending}
                      isConfirming={approveTagConfirming}
                      isConfirmed={approveTagConfirmed}
                      isError={approveTagError}
                      error={approveTagErr}
                    />
                  </div>

                  {/* Step 2: Wrap */}
                  <div className="rounded-lg border p-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Step 2: Wrap TAG → wTAG
                    </p>
                    <Button
                      size="sm"
                      disabled={
                        lockoutActive ||
                        !isConnected ||
                        !wrapAmount ||
                        !approveTagConfirmed ||
                        wrapPending ||
                        wrapConfirming
                      }
                      onClick={handleWrap}
                      className="w-full"
                    >
                      {wrapPending || wrapConfirming ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : null}
                      Wrap TAG → wTAG
                    </Button>
                    <TransactionStatus
                      hash={wrapHash}
                      isPending={wrapPending}
                      isConfirming={wrapConfirming}
                      isConfirmed={wrapConfirmed}
                      isError={wrapError}
                      error={wrapErr}
                    />
                  </div>
                </div>
              )}

              {activeTab === "unwrap" && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="unwrap-amount">Amount (wTAG)</Label>
                    <div className="flex gap-2">
                      <Input
                        id="unwrap-amount"
                        type="number"
                        placeholder="0.00"
                        value={unwrapAmount}
                        onChange={(e) => setUnwrapAmount(e.target.value)}
                        disabled={!isConnected}
                        min="0"
                        step="any"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!isConnected || data.wtagBalance === 0n}
                        onClick={() => setUnwrapAmount(formatEther(data.wtagBalance))}
                      >
                        Max
                      </Button>
                    </div>
                  </div>
                  <Button
                    disabled={!isConnected || !unwrapAmount || unwrapPending || unwrapConfirming}
                    onClick={handleUnwrap}
                    className="w-full"
                  >
                    {unwrapPending || unwrapConfirming ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    Unwrap wTAG → TAG
                  </Button>
                  <TransactionStatus
                    hash={unwrapHash}
                    isPending={unwrapPending}
                    isConfirming={unwrapConfirming}
                    isConfirmed={unwrapConfirmed}
                    isError={unwrapError}
                    error={unwrapErr}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Staking ── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4" />
                Staking
              </CardTitle>
              <CardDescription>
                Stake wTAG to earn rewards. Total staked:{" "}
                <span className="font-mono">{formatTokenAmount(data.totalStaked, "wTAG")}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Staking warnings */}
              {data.stakingPaused && (
                <div className="flex items-center gap-2 rounded-md border border-orange-500/40 bg-orange-500/10 px-3 py-2 text-sm text-orange-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  Staking contract is paused.
                </div>
              )}
              {lockoutActive && !data.stakingPaused && (
                <div className="flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  <Lock className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Staking disabled during lockout. Unlocks in{" "}
                    <span className="font-mono font-medium">
                      {formatCountdown(data.lockoutEnd)}
                    </span>
                    .
                  </span>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                {/* Deposit */}
                <div className="rounded-lg border p-4 space-y-3">
                  <p className="text-sm font-medium">Stake wTAG</p>
                  <div className="space-y-1.5">
                    <Label htmlFor="stake-amount">Amount (wTAG)</Label>
                    <div className="flex gap-2">
                      <Input
                        id="stake-amount"
                        type="number"
                        placeholder="0.00"
                        value={stakeAmount}
                        onChange={(e) => setStakeAmount(e.target.value)}
                        disabled={stakingBlocked || !isConnected}
                        min="0"
                        step="any"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={stakingBlocked || !isConnected || data.wtagBalance === 0n}
                        onClick={() => setStakeAmount(formatEther(data.wtagBalance))}
                      >
                        Max
                      </Button>
                    </div>
                  </div>
                  {/* Approve wTAG for staking */}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      stakingBlocked ||
                      !isConnected ||
                      !stakeAmount ||
                      approveWtagPending ||
                      approveWtagConfirming
                    }
                    onClick={handleApproveForStake}
                    className="w-full"
                  >
                    {approveWtagPending || approveWtagConfirming ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : approveWtagConfirmed ? (
                      <CheckCircle2 className="h-4 w-4 mr-2 text-green-400" />
                    ) : null}
                    {approveWtagConfirmed ? "wTAG Approved" : "1. Approve wTAG"}
                  </Button>
                  <TransactionStatus
                    hash={approveWtagHash}
                    isPending={approveWtagPending}
                    isConfirming={approveWtagConfirming}
                    isConfirmed={approveWtagConfirmed}
                    isError={approveWtagError}
                    error={approveWtagErr}
                  />
                  <Button
                    size="sm"
                    disabled={
                      stakingBlocked ||
                      !isConnected ||
                      !stakeAmount ||
                      !approveWtagConfirmed ||
                      stakePending ||
                      stakeConfirming
                    }
                    onClick={handleStake}
                    className="w-full"
                  >
                    {stakePending || stakeConfirming ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    2. Stake wTAG
                  </Button>
                  <TransactionStatus
                    hash={stakeHash}
                    isPending={stakePending}
                    isConfirming={stakeConfirming}
                    isConfirmed={stakeConfirmed}
                    isError={stakeError}
                    error={stakeErr}
                  />
                </div>

                {/* Withdraw */}
                <div className="rounded-lg border p-4 space-y-3">
                  <p className="text-sm font-medium">Withdraw wTAG</p>
                  <div className="space-y-1.5">
                    <Label htmlFor="withdraw-amount">Amount (wTAG)</Label>
                    <div className="flex gap-2">
                      <Input
                        id="withdraw-amount"
                        type="number"
                        placeholder="0.00"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        disabled={stakingBlocked || !isConnected}
                        min="0"
                        step="any"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={stakingBlocked || !isConnected || data.stakedBalance === 0n}
                        onClick={() => setWithdrawAmount(formatEther(data.stakedBalance))}
                      >
                        Max
                      </Button>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      stakingBlocked ||
                      !isConnected ||
                      !withdrawAmount ||
                      withdrawPending ||
                      withdrawConfirming
                    }
                    onClick={handleWithdraw}
                    className="w-full"
                  >
                    {withdrawPending || withdrawConfirming ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    Withdraw wTAG
                  </Button>
                  <TransactionStatus
                    hash={withdrawHash}
                    isPending={withdrawPending}
                    isConfirming={withdrawConfirming}
                    isConfirmed={withdrawConfirmed}
                    isError={withdrawError}
                    error={withdrawErr}
                  />

                  {/* Claim Rewards */}
                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">Pending Rewards</p>
                      <p className="font-mono text-sm text-green-400">
                        {formatTokenAmount(data.pendingRewards, "wTAG")}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      disabled={
                        stakingBlocked ||
                        !isConnected ||
                        data.pendingRewards === 0n ||
                        claimPending ||
                        claimConfirming
                      }
                      onClick={handleClaim}
                      className="w-full"
                    >
                      {claimPending || claimConfirming ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : null}
                      Claim Rewards
                    </Button>
                    <TransactionStatus
                      hash={claimHash}
                      isPending={claimPending}
                      isConfirming={claimConfirming}
                      isConfirmed={claimConfirmed}
                      isError={claimError}
                      error={claimErr}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Contract Info ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contract Info</CardTitle>
              <CardDescription>
                Deployed contract addresses on Base Sepolia (chainId 84532)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-3">
                {(
                  [
                    { label: "TAGITToken (TAG)", address: CONTRACTS.TAGITToken },
                    { label: "wTAG", address: CONTRACTS.wTAG },
                    { label: "wTAGStaking", address: CONTRACTS.wTAGStaking },
                  ] as const
                ).map(({ label, address }) => (
                  <div key={address} className="rounded-lg border p-4 space-y-2">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <AddressBadge address={address} chainId={chainId} truncate />
                    <a
                      href={explorerLink(address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View on BaseScan
                    </a>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-4 space-y-1">
                  <p className="text-xs text-muted-foreground">TGE Timestamp</p>
                  <p className="text-sm font-mono">{formatTimestamp(data.tgeTimestamp)}</p>
                </div>
                <div className="rounded-lg border p-4 space-y-1">
                  <p className="text-xs text-muted-foreground">Lockout End</p>
                  <p className="text-sm font-mono">
                    {data.lockoutEnd > 0n ? formatTimestamp(data.lockoutEnd) : "Not set"}
                  </p>
                  {lockoutActive && data.lockoutEnd > 0n && (
                    <p className="text-xs text-red-400 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatCountdown(data.lockoutEnd)} remaining
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* No wallet, no data, but on correct chain */}
      {!loading && !data && !error && (
        <Card className="border-muted">
          <CardContent className="pt-6 pb-6 text-center text-sm text-muted-foreground">
            Could not load token data. Check your RPC connection.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
