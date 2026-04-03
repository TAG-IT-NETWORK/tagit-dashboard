"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePublicClient, useChainId } from "wagmi";
import { formatEther } from "viem";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Badge,
  AddressBadge,
} from "@tagit/ui";
import { getContractsForChain, TAGITTreasuryABI, getExplorerAddressUrl } from "@tagit/contracts";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  AlertCircle,
  PieChart,
  FileText,
  Loader2,
  RefreshCw,
  Database,
  ArrowDownToLine,
  Hash,
} from "lucide-react";

// ── Minimal ABI extensions not in the shared ABI ──

const COUNT_ABI = [
  {
    name: "getAllocationCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getWithdrawalCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "owner",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

// ── Types ──

interface AllocationData {
  id: number;
  programId: string;
  amount: bigint;
  spent: bigint;
  recipient: `0x${string}`;
  createdAt: number;
  expiresAt: number;
  active: boolean;
}

interface WithdrawalData {
  id: number;
  allocationId: bigint;
  amount: bigint;
  token: `0x${string}`;
  to: `0x${string}`;
  queuedAt: number;
  executesAt: number;
  status: number;
}

interface TreasuryState {
  ethBalance: bigint;
  tagitBalance: bigint;
  totalAllocated: bigint;
  totalUnallocated: bigint;
  allocationCount: number;
  withdrawalCount: number;
  governor: `0x${string}`;
  owner: `0x${string}`;
  allocations: AllocationData[];
  withdrawals: WithdrawalData[];
}

// ── Helpers ──

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as `0x${string}`;

const WITHDRAWAL_STATUS: Record<number, { label: string; className: string }> = {
  0: { label: "Pending", className: "bg-yellow-500/20 text-yellow-400" },
  1: { label: "Executed", className: "bg-green-500/20 text-green-400" },
  2: { label: "Canceled", className: "bg-gray-500/20 text-gray-400" },
};

function formatEth(value: bigint, decimals = 4): string {
  const eth = parseFloat(formatEther(value));
  return eth.toFixed(decimals);
}

function formatBytes32Label(bytes32: string): string {
  // Convert bytes32 hex to a human-readable label if it's ASCII
  try {
    const hex = bytes32.replace("0x", "");
    const bytes = hex.match(/.{1,2}/g) ?? [];
    const ascii = bytes
      .map((b) => parseInt(b, 16))
      .filter((c) => c > 31 && c < 127)
      .map((c) => String.fromCharCode(c))
      .join("")
      .trim();
    return ascii.length > 0 ? ascii : bytes32.slice(0, 10) + "...";
  } catch {
    return bytes32.slice(0, 10) + "...";
  }
}

function formatTimestamp(ts: number): string {
  if (ts === 0) return "—";
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ── Metric Card ──

function StatCard({
  title,
  value,
  subtitle,
  icon,
  borderClass = "border-border",
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  borderClass?: string;
}) {
  return (
    <Card className={`border ${borderClass}`}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1 font-mono">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className="text-muted-foreground">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Allocations Table ──

function AllocationsTable({
  allocations,
  chainId,
}: {
  allocations: AllocationData[];
  chainId: number;
}) {
  if (allocations.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground text-sm">
        No allocations found on this contract.
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">ID</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Program</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Recipient</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Amount (ETH)</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Spent (ETH)</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Expires</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
          </tr>
        </thead>
        <tbody>
          {allocations.map((a) => (
            <tr key={a.id} className="border-b hover:bg-muted/50 transition-colors">
              <td className="px-4 py-3 font-mono">#{a.id}</td>
              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                {formatBytes32Label(a.programId)}
              </td>
              <td className="px-4 py-3">
                <AddressBadge address={a.recipient} chainId={chainId} truncate showCopy={false} />
              </td>
              <td className="px-4 py-3 font-mono">{formatEth(a.amount)}</td>
              <td className="px-4 py-3 font-mono">{formatEth(a.spent)}</td>
              <td className="px-4 py-3 text-muted-foreground">{formatTimestamp(a.expiresAt)}</td>
              <td className="px-4 py-3">
                <Badge
                  variant="outline"
                  className={
                    a.active
                      ? "text-green-400 border-green-400/30"
                      : "text-gray-400 border-gray-400/30"
                  }
                >
                  {a.active ? "Active" : "Closed"}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Withdrawals Table ──

function WithdrawalsTable({
  withdrawals,
  chainId,
}: {
  withdrawals: WithdrawalData[];
  chainId: number;
}) {
  if (withdrawals.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground text-sm">
        No withdrawals found on this contract.
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">ID</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Allocation</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">To</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Token</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Amount (ETH)</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Executes</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
          </tr>
        </thead>
        <tbody>
          {withdrawals.map((w) => {
            const statusInfo = WITHDRAWAL_STATUS[w.status] ?? WITHDRAWAL_STATUS[0];
            const isNativeEth =
              w.token === ZERO_ADDRESS || w.token === "0x0000000000000000000000000000000000000000";
            return (
              <tr key={w.id} className="border-b hover:bg-muted/50 transition-colors">
                <td className="px-4 py-3 font-mono">#{w.id}</td>
                <td className="px-4 py-3 font-mono text-muted-foreground">
                  #{w.allocationId.toString()}
                </td>
                <td className="px-4 py-3">
                  <AddressBadge address={w.to} chainId={chainId} truncate showCopy={false} />
                </td>
                <td className="px-4 py-3">
                  {isNativeEth ? (
                    <Badge variant="outline" className="text-blue-400 border-blue-400/30">
                      ETH
                    </Badge>
                  ) : (
                    <AddressBadge address={w.token} chainId={chainId} truncate showCopy={false} />
                  )}
                </td>
                <td className="px-4 py-3 font-mono">{formatEth(w.amount)}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatTimestamp(w.executesAt)}</td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className={statusInfo.className}>
                    {statusInfo.label}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Page ──

export default function TreasuryPage() {
  const chainId = useChainId();
  const client = usePublicClient();

  const [data, setData] = useState<TreasuryState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const contracts = getContractsForChain(chainId);
  const treasuryAddress = contracts.TAGITTreasury;

  const fetchTreasury = useCallback(async () => {
    if (!client) {
      setError("No RPC client available");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch core stats in parallel
      const [
        balance,
        totalAllocated,
        totalUnallocated,
        allocationCount,
        withdrawalCount,
        governor,
        owner,
      ] = await Promise.all([
        client.readContract({
          address: treasuryAddress,
          abi: TAGITTreasuryABI,
          functionName: "getBalance",
        }),
        client.readContract({
          address: treasuryAddress,
          abi: TAGITTreasuryABI,
          functionName: "totalAllocated",
        }),
        client.readContract({
          address: treasuryAddress,
          abi: TAGITTreasuryABI,
          functionName: "totalUnallocated",
        }),
        client
          .readContract({
            address: treasuryAddress,
            abi: COUNT_ABI,
            functionName: "getAllocationCount",
          })
          .catch(() => 0n),
        client
          .readContract({
            address: treasuryAddress,
            abi: COUNT_ABI,
            functionName: "getWithdrawalCount",
          })
          .catch(() => 0n),
        client
          .readContract({
            address: treasuryAddress,
            abi: TAGITTreasuryABI,
            functionName: "governor",
          })
          .catch(() => ZERO_ADDRESS),
        client
          .readContract({
            address: treasuryAddress,
            abi: COUNT_ABI,
            functionName: "owner",
          })
          .catch(() => ZERO_ADDRESS),
      ]);

      const [ethBalance, tagitBalance] = balance as [bigint, bigint];
      const allocCount = Number(allocationCount);
      const wdCount = Number(withdrawalCount);

      // Fetch allocations
      const allocations: AllocationData[] = [];
      for (let i = 1; i <= allocCount; i++) {
        try {
          const raw = await client.readContract({
            address: treasuryAddress,
            abi: TAGITTreasuryABI,
            functionName: "getAllocation",
            args: [BigInt(i)],
          });
          const a = raw as unknown as {
            programId: `0x${string}`;
            amount: bigint;
            spent: bigint;
            recipient: `0x${string}`;
            createdAt: bigint;
            expiresAt: bigint;
            active: boolean;
          };
          allocations.push({
            id: i,
            programId: a.programId,
            amount: a.amount,
            spent: a.spent,
            recipient: a.recipient,
            createdAt: Number(a.createdAt),
            expiresAt: Number(a.expiresAt),
            active: a.active,
          });
        } catch {
          // Skip allocations that revert (out of bounds, etc.)
        }
      }

      // Fetch withdrawals
      const withdrawals: WithdrawalData[] = [];
      for (let i = 1; i <= wdCount; i++) {
        try {
          const raw = await client.readContract({
            address: treasuryAddress,
            abi: TAGITTreasuryABI,
            functionName: "getWithdrawal",
            args: [BigInt(i)],
          });
          const w = raw as unknown as {
            allocationId: bigint;
            amount: bigint;
            token: `0x${string}`;
            to: `0x${string}`;
            queuedAt: bigint;
            executesAt: bigint;
            status: number;
          };
          withdrawals.push({
            id: i,
            allocationId: w.allocationId,
            amount: w.amount,
            token: w.token,
            to: w.to,
            queuedAt: Number(w.queuedAt),
            executesAt: Number(w.executesAt),
            status: w.status,
          });
        } catch {
          // Skip withdrawals that revert
        }
      }

      setData({
        ethBalance,
        tagitBalance,
        totalAllocated: totalAllocated as bigint,
        totalUnallocated: totalUnallocated as bigint,
        allocationCount: allocCount,
        withdrawalCount: wdCount,
        governor: governor as `0x${string}`,
        owner: owner as `0x${string}`,
        allocations,
        withdrawals,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read treasury contract");
    } finally {
      setLoading(false);
    }
  }, [client, treasuryAddress]);

  useEffect(() => {
    fetchTreasury();
  }, [fetchTreasury]);

  const explorerUrl = getExplorerAddressUrl(chainId, treasuryAddress);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" />
            Treasury
          </h1>
          <p className="text-muted-foreground">Live on-chain treasury data from TAGITTreasury</p>
        </div>
        <div className="flex items-center gap-2">
          <a href={explorerUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              <ExternalLink className="h-4 w-4 mr-2" />
              Explorer
            </Button>
          </a>
          <Button variant="outline" size="sm" onClick={fetchTreasury} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Link href="/governance/new">
            <Button>
              <FileText className="h-4 w-4 mr-2" />
              Create Proposal
            </Button>
          </Link>
        </div>
      </div>

      {/* Contract Address */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Hash className="h-4 w-4 shrink-0" />
              <span>Contract:</span>
            </div>
            <AddressBadge address={treasuryAddress} chainId={chainId} />
          </div>
        </CardContent>
      </Card>

      {/* Error */}
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

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Live Data */}
      {!loading && data && (
        <>
          {/* Stats Row */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="ETH Balance"
              value={`${formatEth(data.ethBalance)} ETH`}
              subtitle="Native ETH held by contract"
              icon={<Wallet className="h-5 w-5" />}
              borderClass="border-primary/50"
            />
            <StatCard
              title="TAGIT Balance"
              value={`${formatEth(data.tagitBalance)} TAGIT`}
              subtitle="TAGIT token balance"
              icon={<TrendingUp className="h-5 w-5 text-violet-400" />}
              borderClass="border-violet-500/50"
            />
            <StatCard
              title="Total Allocated"
              value={`${formatEth(data.totalAllocated)} ETH`}
              subtitle={`Across ${data.allocationCount} allocation${data.allocationCount !== 1 ? "s" : ""}`}
              icon={<TrendingDown className="h-5 w-5 text-orange-400" />}
              borderClass="border-orange-500/50"
            />
            <StatCard
              title="Unallocated"
              value={`${formatEth(data.totalUnallocated)} ETH`}
              subtitle="Available for new proposals"
              icon={<Database className="h-5 w-5 text-green-400" />}
              borderClass="border-green-500/50"
            />
          </div>

          {/* Governance Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <PieChart className="h-4 w-4" />
                Contract Info
              </CardTitle>
              <CardDescription>On-chain governance and ownership details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border p-4 space-y-1">
                  <p className="text-xs text-muted-foreground">Governor</p>
                  {data.governor !== ZERO_ADDRESS ? (
                    <AddressBadge address={data.governor} chainId={chainId} />
                  ) : (
                    <p className="text-sm text-muted-foreground">Not set</p>
                  )}
                </div>
                <div className="rounded-lg border p-4 space-y-1">
                  <p className="text-xs text-muted-foreground">Owner</p>
                  {data.owner !== ZERO_ADDRESS ? (
                    <AddressBadge address={data.owner} chainId={chainId} />
                  ) : (
                    <p className="text-sm text-muted-foreground">Not set</p>
                  )}
                </div>
                <div className="rounded-lg border p-4 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Allocations</p>
                  <p className="text-xl font-bold font-mono">{data.allocationCount}</p>
                </div>
                <div className="rounded-lg border p-4 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Withdrawals</p>
                  <p className="text-xl font-bold font-mono">{data.withdrawalCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Allocations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Allocations
              </CardTitle>
              <CardDescription>
                {data.allocationCount > 0
                  ? `${data.allocationCount} allocation${data.allocationCount !== 1 ? "s" : ""} on this contract`
                  : "No allocations have been created yet"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AllocationsTable allocations={data.allocations} chainId={chainId} />
            </CardContent>
          </Card>

          {/* Withdrawals */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowDownToLine className="h-5 w-5" />
                Withdrawals
              </CardTitle>
              <CardDescription>
                {data.withdrawalCount > 0
                  ? `${data.withdrawalCount} withdrawal${data.withdrawalCount !== 1 ? "s" : ""} queued or executed`
                  : "No withdrawals have been queued yet"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WithdrawalsTable withdrawals={data.withdrawals} chainId={chainId} />
            </CardContent>
          </Card>
        </>
      )}

      {/* Empty state — contract responded but nothing is in it */}
      {!loading &&
        data &&
        data.allocationCount === 0 &&
        data.withdrawalCount === 0 &&
        data.ethBalance === 0n && (
          <Card className="border-muted">
            <CardContent className="pt-6 pb-6 text-center">
              <Wallet className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-sm">
                Treasury contract is deployed but holds no ETH and has no allocations yet.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Create a governance proposal to fund and allocate treasury resources.
              </p>
            </CardContent>
          </Card>
        )}
    </div>
  );
}
