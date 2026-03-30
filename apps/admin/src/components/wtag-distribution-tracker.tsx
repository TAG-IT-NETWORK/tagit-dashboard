"use client";

import { useWTagDistribution, type WTagHolder } from "@tagit/contracts";
import { shortenAddress, getExplorerTxUrl } from "@tagit/contracts";
import { useChainId } from "wagmi";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  Badge,
} from "@tagit/ui";
import {
  Coins,
  ExternalLink,
  Loader2,
  AlertCircle,
  RefreshCw,
  Inbox,
  TrendingUp,
  Flame,
} from "lucide-react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// ─── Helpers ────────────────────────────────────────────────────────────

function formatWTag(value: bigint): string {
  // wTAG has 18 decimals
  const whole = value / 10n ** 18n;
  if (whole >= 1_000_000n) return `${(Number(whole) / 1_000_000).toFixed(1)}M`;
  if (whole >= 1_000n) return `${(Number(whole) / 1_000).toFixed(1)}K`;
  return whole.toString();
}

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ─── Skeleton ───────────────────────────────────────────────────────────

function DistributionSkeleton() {
  return (
    <div className="space-y-4" data-testid="distribution-skeleton">
      {/* Chart skeleton */}
      <div className="h-[120px] bg-muted rounded animate-pulse" />
      {/* Holder rows skeleton */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between py-2 border-b border-border last:border-0 animate-pulse"
        >
          <div className="h-3 w-32 bg-muted rounded" />
          <div className="h-3 w-20 bg-muted rounded" />
        </div>
      ))}
    </div>
  );
}

// ─── Empty State ────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center py-8 text-muted-foreground"
      data-testid="distribution-empty"
    >
      <Inbox className="h-10 w-10 mb-3 opacity-50" />
      <p className="text-sm font-medium">No wTAG data yet</p>
      <p className="text-xs mt-1">
        wTAG distribution data will appear once tokens are minted on testnet.
      </p>
    </div>
  );
}

// ─── Error State ────────────────────────────────────────────────────────

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-8 text-muted-foreground"
      data-testid="distribution-error"
    >
      <AlertCircle className="h-10 w-10 mb-3 text-destructive opacity-70" />
      <p className="text-sm font-medium">Failed to load distribution</p>
      <p className="text-xs mt-1 max-w-[250px] text-center">{message}</p>
      <button
        onClick={onRetry}
        className="mt-3 text-xs text-primary hover:underline flex items-center gap-1"
      >
        <RefreshCw className="h-3 w-3" /> Retry
      </button>
    </div>
  );
}

// ─── Transfer Sparkline ─────────────────────────────────────────────────

function TransferSparkline({
  transfers,
}: {
  transfers: { timestamp: number; value: bigint }[];
}) {
  // Bucket transfers into hourly intervals for the sparkline
  if (transfers.length === 0) return null;

  const sorted = [...transfers].sort((a, b) => a.timestamp - b.timestamp);
  const bucketMs = 3600 * 1000; // 1 hour
  const earliest = sorted[0].timestamp;
  const latest = sorted[sorted.length - 1].timestamp;
  const bucketCount = Math.max(Math.ceil((latest - earliest) / bucketMs), 1);

  const chartData = Array.from({ length: Math.min(bucketCount + 1, 24) }, (_, i) => {
    const bucketStart = earliest + i * bucketMs;
    const bucketEnd = bucketStart + bucketMs;
    const bucketTransfers = sorted.filter(
      (t) => t.timestamp >= bucketStart && t.timestamp < bucketEnd,
    );
    const volume = bucketTransfers.reduce(
      (sum, t) => sum + Number(t.value / 10n ** 18n),
      0,
    );
    return {
      time: new Date(bucketStart).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      volume,
    };
  });

  return (
    <div className="h-[120px]" data-testid="transfer-sparkline">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="wtagGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="time" hide />
          <YAxis hide />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg text-sm">
                    <p className="text-muted-foreground">{payload[0].payload.time}</p>
                    <p className="font-medium">{payload[0].value} wTAG</p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Area
            type="monotone"
            dataKey="volume"
            stroke="#a855f7"
            strokeWidth={2}
            fill="url(#wtagGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Holder Row ─────────────────────────────────────────────────────────

function HolderRow({
  holder,
  rank,
  chainId,
}: {
  holder: WTagHolder;
  rank: number;
  chainId: number;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-muted-foreground w-5">
          {rank}
        </span>
        <span className="text-sm font-mono text-muted-foreground hover:text-primary transition-colors">
          {shortenAddress(holder.address)}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">{formatWTag(holder.balance)}</span>
        <span className="text-xs text-muted-foreground w-14 text-right">
          {holder.sharePercent.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────

export function WTagDistributionTracker({
  topN = 10,
  pollingInterval = 30000,
}: {
  topN?: number;
  pollingInterval?: number;
}) {
  const chainId = useChainId();
  const { data, isLoading, error, refetch, enabled } = useWTagDistribution(
    topN,
    20,
    pollingInterval,
  );

  const hasData = data && (data.holders.length > 0 || data.totalSupply > 0n);

  return (
    <Card data-testid="wtag-distribution-tracker">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">wTAG Distribution</CardTitle>
          </div>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        <CardDescription>
          Token holder balances and transfer volume
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!enabled ? (
          <EmptyState />
        ) : isLoading && !data ? (
          <DistributionSkeleton />
        ) : error ? (
          <ErrorState message={error.message} onRetry={refetch} />
        ) : !hasData ? (
          <EmptyState />
        ) : (
          <div className="space-y-4">
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-lg font-bold">
                  {formatWTag(data!.totalSupply)}
                </p>
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <TrendingUp className="h-3 w-3" /> Supply
                </p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold">
                  {data!.totalTransfers.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Transfers</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold">
                  {formatWTag(data!.totalBurned)}
                </p>
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <Flame className="h-3 w-3" /> Burned
                </p>
              </div>
            </div>

            {/* Transfer volume sparkline */}
            {data!.recentTransfers.length > 1 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Transfer Volume</p>
                <TransferSparkline transfers={data!.recentTransfers} />
              </div>
            )}

            {/* Top holders */}
            {data!.holders.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">
                  Top {data!.holders.length} Holders
                </p>
                <div className="space-y-0">
                  {data!.holders.map((holder, i) => (
                    <HolderRow
                      key={holder.address}
                      holder={holder}
                      rank={i + 1}
                      chainId={chainId}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
