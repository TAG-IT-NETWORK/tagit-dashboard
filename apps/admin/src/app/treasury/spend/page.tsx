"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  MetricCard,
} from "@tagit/ui";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  XCircle,
  Layers,
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { useTreasurySpend } from "@/lib/hooks/use-treasury-spend";
import { SpendTable } from "@/components/treasury/spend-table";
import { SpendChart } from "@/components/treasury/spend-chart";

// ─── Loading Skeleton ───────────────────────────────────────────────────

function SpendSkeleton() {
  return (
    <div className="space-y-6" data-testid="spend-skeleton">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-64 bg-muted animate-pulse rounded" />
          <div className="h-4 w-96 bg-muted animate-pulse rounded" />
        </div>
      </div>

      {/* Stats skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="h-4 w-24 bg-muted animate-pulse rounded mb-2" />
              <div className="h-8 w-32 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart skeleton */}
      <Card>
        <CardHeader>
          <div className="h-6 w-40 bg-muted animate-pulse rounded" />
        </CardHeader>
        <CardContent>
          <div className="h-[300px] bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>

      {/* Table skeleton */}
      <Card>
        <CardHeader>
          <div className="h-6 w-32 bg-muted animate-pulse rounded" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Error State ────────────────────────────────────────────────────────

function SpendError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="space-y-6" data-testid="spend-error">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" />
            Treasury Spend Report
          </h1>
        </div>
      </div>
      <Card className="border-red-500/50">
        <CardContent className="p-8 text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Failed to load spend data</h3>
          <p className="text-muted-foreground mb-4">{error.message}</p>
          <Button onClick={onRetry}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Empty State ────────────────────────────────────────────────────────

function SpendEmpty() {
  return (
    <Card data-testid="spend-empty">
      <CardContent className="p-8 text-center">
        <Layers className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No spend data yet</h3>
        <p className="text-muted-foreground">
          Treasury spend events will appear here once allocations and withdrawals are indexed.
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────

function formatCompact(value: string): string {
  const num = Number(value);
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toLocaleString();
}

// ─── Main Page ──────────────────────────────────────────────────────────

export default function TreasurySpendPage() {
  const { data, isLoading, error, refetch } = useTreasurySpend();

  if (isLoading) return <SpendSkeleton />;
  if (error) return <SpendError error={error} onRetry={refetch} />;
  if (!data) return <SpendEmpty />;

  const { summary, events, byPeriod } = data;
  const hasEvents = events.length > 0;

  return (
    <div className="space-y-6" data-testid="spend-dashboard">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/treasury">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Treasury
              </Button>
            </Link>
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" />
            Spend Report
          </h1>
          <p className="text-muted-foreground">
            On-chain treasury allocations, withdrawals, and deposit tracking
          </p>
        </div>
        <Button variant="outline" onClick={refetch}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Demo Mode Indicator */}
      {!process.env.NEXT_PUBLIC_API_URL && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <span className="text-sm text-yellow-600">
            Demo Mode: Using mock data. Set NEXT_PUBLIC_API_URL for live treasury data.
          </span>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Allocated"
          value={formatCompact(summary.totalAllocated)}
          icon={<Layers className="h-5 w-5" />}
          className="border-primary/50"
        />
        <MetricCard
          title="Total Spent"
          value={formatCompact(summary.totalSpent)}
          icon={<TrendingDown className="h-5 w-5 text-red-500" />}
          className="border-red-500/50"
        />
        <MetricCard
          title="Total Deposited"
          value={formatCompact(summary.totalDeposited)}
          icon={<TrendingUp className="h-5 w-5 text-green-500" />}
          className="border-green-500/50"
        />
        <MetricCard
          title="Pending Withdrawals"
          value={String(summary.pendingWithdrawals)}
          icon={<Clock className="h-5 w-5 text-yellow-500" />}
          className="border-yellow-500/50"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          title="Active Allocations"
          value={String(summary.activeAllocations)}
          icon={<Layers className="h-5 w-5 text-blue-500" />}
        />
        <MetricCard
          title="Executed Withdrawals"
          value={String(summary.executedWithdrawals)}
          icon={<CheckCircle className="h-5 w-5 text-green-500" />}
        />
        <MetricCard
          title="Canceled Withdrawals"
          value={String(summary.canceledWithdrawals)}
          icon={<XCircle className="h-5 w-5 text-gray-500" />}
        />
      </div>

      {/* Chart */}
      <SpendChart byPeriod={byPeriod} />

      {/* Events Table or Empty */}
      {hasEvents ? <SpendTable events={events} /> : <SpendEmpty />}
    </div>
  );
}
