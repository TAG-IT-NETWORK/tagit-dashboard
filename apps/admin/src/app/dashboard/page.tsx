"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  useTotalSupply,
  useDashboardData,
  shortenAddress,
  getExplorerTxUrl,
  type StateDistribution,
  type ActivityItem,
  type TopUser,
} from "@tagit/contracts";
import { useChainId } from "wagmi";
import { WagmiGuard } from "@/components/wagmi-guard";
import { EventFeed } from "@/components/event-feed";
import { StatsBar } from "@/components/stats-bar";
import { AgentActivityMonitor } from "@/components/agent-activity-monitor";
import { WTagDistributionTracker } from "@/components/wtag-distribution-tracker";
import {
  lifecycleDistribution,
  needsAttention,
  parseDashboardStats,
  type DashboardStatsDto,
} from "@/lib/dashboard/stats";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  MetricCard,
  Button,
  StateBadge,
  Badge,
} from "@tagit/ui";
import {
  Package,
  AlertTriangle,
  Plus,
  Layers,
  ShoppingBag,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  FlaskConical,
  Nfc,
  Play,
  RefreshCw,
  Loader2,
  Database,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

const stateColors: Record<number, string> = {
  0: "#6b7280",
  1: "#3b82f6",
  2: "#22c55e",
  3: "#a855f7",
  4: "#ef4444",
  5: "#f97316",
};

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

export default function DashboardPage() {
  return (
    <WagmiGuard>
      <DashboardContent />
    </WagmiGuard>
  );
}

function DashboardContent() {
  const chainId = useChainId();
  const { data: totalSupply, isLoading: supplyLoading } = useTotalSupply();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Subgraph data with 30s polling
  const {
    globalStats,
    stateDistribution,
    recentActivity,
    recentFlags,
    topUsers,
    dailyMints,
    activeUsers,
    isLoading: subgraphLoading,
    error: subgraphError,
    refetch,
  } = useDashboardData(30000);

  // Catalog stats — the real operational numbers (services admin list),
  // computed server-side by /api/dashboard-stats. No indexer needed.
  const [catalog, setCatalog] = useState<DashboardStatsDto | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const loadCatalog = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard-stats", { cache: "no-store" });
      const body: unknown = await res.json().catch(() => null);
      const parsed = res.ok ? parseDashboardStats(body) : null;
      if (!parsed) {
        const err = (body as { error?: unknown } | null)?.error;
        setCatalogError(
          typeof err === "string" ? err : `catalog stats unavailable (${res.status || "network"})`,
        );
        return;
      }
      setCatalog(parsed);
      setCatalogError(null);
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : "catalog stats unavailable");
    }
  }, []);
  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  // Subgraph (when NEXT_PUBLIC_SUBGRAPH_URL is configured) wins for chain-wide
  // figures; otherwise every number below comes from the catalog or the
  // contract itself — never a placeholder.
  const useSubgraphData = !subgraphError && globalStats;
  const stats = catalog?.catalog ?? null;
  const catalogLoading = catalog === null && catalogError === null;

  const totalAssets = useSubgraphData
    ? globalStats.totalAssets
    : totalSupply
      ? Number(totalSupply)
      : (stats?.totalItems ?? 0);

  const displayStateDistribution: StateDistribution[] =
    useSubgraphData && stateDistribution
      ? stateDistribution
      : stats
        ? (lifecycleDistribution(stats) as StateDistribution[])
        : [];
  const displayRecentActivity: ActivityItem[] =
    useSubgraphData && recentActivity ? recentActivity : [];
  const displayTopUsers: TopUser[] = useSubgraphData && topUsers ? topUsers : [];

  const flaggedAssets = useSubgraphData
    ? (displayStateDistribution.find((s) => s.state === 4)?.value ?? 0)
    : 0;
  const attention = stats ? needsAttention(stats) : 0;
  const dailyMintsLabel = useSubgraphData && dailyMints !== null ? String(dailyMints) : null;
  const activeUsersLabel = useSubgraphData && activeUsers !== null ? String(activeUsers) : null;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refetch(), loadCatalog()]);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>Overview of the TAG IT Network</span>
            {useSubgraphData ? (
              <Badge variant="outline" className="text-xs gap-1">
                <Database className="h-3 w-3" />
                Live · indexer
              </Badge>
            ) : stats ? (
              <Badge variant="outline" className="text-xs gap-1">
                <Database className="h-3 w-3" />
                Live · catalog{stats.truncated ? " (partial)" : ""}
              </Badge>
            ) : catalogError ? (
              <Badge variant="secondary" className="text-xs text-destructive" title={catalogError}>
                Catalog unavailable
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">
                Loading…
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Refresh data"
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
          {useSubgraphData ? (
            <Button variant="outline" asChild>
              <Link href="/resolve">
                <AlertTriangle className="h-4 w-4 mr-2" />
                View Flagged ({flaggedAssets})
              </Link>
            </Button>
          ) : (
            <Button variant="outline" asChild>
              <Link href={attention > 0 ? "/assets?drift=true" : "/assets"}>
                <ShieldAlert className="h-4 w-4 mr-2" />
                Needs attention ({attention})
              </Link>
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link href="/catalog">
              <Plus className="h-4 w-4 mr-2" />
              New batch
            </Link>
          </Button>
          <Button asChild>
            <Link href="/station">
              <Nfc className="h-4 w-4 mr-2" />
              Binding Station
            </Link>
          </Button>
        </div>
      </div>

      {/* Metrics Row — chain + catalog truth; indexer-only figures show as "not indexed" */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Assets (on-chain)"
          value={totalAssets.toLocaleString()}
          icon={<Package className="h-5 w-5" />}
          loading={supplyLoading || subgraphLoading}
        />
        <MetricCard
          title={dailyMintsLabel !== null ? "Daily Mints" : "Catalog items"}
          value={dailyMintsLabel ?? (stats ? stats.totalItems.toLocaleString() : "—")}
          icon={<Layers className="h-5 w-5" />}
          loading={subgraphLoading || catalogLoading}
        />
        <MetricCard
          title={activeUsersLabel !== null ? "Active Users (7d)" : "Listed for sale"}
          value={activeUsersLabel ?? (stats ? stats.listedCount.toLocaleString() : "—")}
          icon={<ShoppingBag className="h-5 w-5" />}
          loading={subgraphLoading || catalogLoading}
        />
        <MetricCard
          title={useSubgraphData ? "Flagged Assets" : "Needs attention"}
          value={useSubgraphData ? flaggedAssets : stats ? attention : "—"}
          icon={useSubgraphData ? <AlertTriangle className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
          className={(useSubgraphData ? flaggedAssets : attention) > 0 ? "border-red-500/50" : ""}
          loading={subgraphLoading || catalogLoading}
        />
      </div>
      {stats && (
        <p className="-mt-2 text-xs text-muted-foreground">
          {stats.boundCount} of {stats.totalItems} catalog items carry a chip · {stats.changedLast24h} changed in the last 24 h
          {stats.driftCount > 0 ? ` · ${stats.driftCount} drift` : ""}
          {stats.reanchorPendingCount > 0 ? ` · ${stats.reanchorPendingCount} re-anchor pending` : ""}
          {stats.needsProductInfoCount > 0 ? ` · ${stats.needsProductInfoCount} need product info` : ""}
        </p>
      )}

      {/* Lifecycle Distribution Bar */}
      <StatsBar distribution={displayStateDistribution} loading={subgraphLoading || catalogLoading} />

      {/* NFC Lifecycle Test Card */}
      {process.env.NODE_ENV === "development" && (
        <Card className="border-dashed border-primary/50 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FlaskConical className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">NFC Lifecycle Test</CardTitle>
                <Badge variant="secondary" className="text-xs">Dev</Badge>
              </div>
              <Button asChild size="sm">
                <Link href="/test/lifecycle">
                  <Play className="h-4 w-4 mr-2" />
                  Start Test
                </Link>
              </Button>
            </div>
            <CardDescription>
              Test the complete asset lifecycle with NTAG424 DNA tags: MINT → BIND → ACTIVATE → CLAIM → FLAG → RESOLVE
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Nfc className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Supports Web NFC on Android Chrome</span>
              </div>
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Manual UID entry for desktop testing</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts and Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* State Distribution Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Asset State Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={displayStateDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {displayStateDistribution.map((entry) => (
                      <Cell key={entry.name} fill={stateColors[entry.state]} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg">
                            <p className="font-medium">{data.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {data.value} assets ({totalAssets > 0 ? ((data.value / totalAssets) * 100).toFixed(1) : 0}%)
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend
                    formatter={(value) => (
                      <span className="text-sm text-foreground">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Activity</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/assets">
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {displayRecentActivity.length > 0 ? (
                displayRecentActivity.map((activity, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/assets/${activity.tokenId}`}
                        className="font-mono text-sm font-medium hover:text-primary transition-colors"
                      >
                        #{activity.tokenId}
                      </Link>
                      <div className="flex items-center gap-1">
                        <StateBadge state={activity.oldState} className="text-xs" />
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <StateBadge state={activity.newState} className="text-xs" />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>{formatRelativeTime(activity.timestamp)}</span>
                      <a
                        href={getExplorerTxUrl(chainId, activity.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-foreground transition-colors"
                        title={activity.txHash}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                ))
              ) : stats && stats.recent.length > 0 ? (
                stats.recent.map((item) => (
                  <div
                    key={item.tokenId}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Link
                        href={`/assets/${item.tokenId}`}
                        className="font-mono text-sm font-medium hover:text-primary transition-colors"
                      >
                        #{item.tokenId}
                      </Link>
                      <span className="truncate text-sm text-muted-foreground">{item.name ?? "Untitled"}</span>
                      <Badge variant="secondary" className="text-xs capitalize">
                        {item.lifecycle || "unknown"}
                      </Badge>
                      {item.saleState === "listed" && (
                        <Badge variant="outline" className="text-xs">
                          listed
                        </Badge>
                      )}
                      {item.saleState === "sold" && (
                        <Badge variant="outline" className="text-xs">
                          sold
                        </Badge>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {item.updatedAt ? formatRelativeTime(Date.parse(item.updatedAt)) : ""}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {catalogLoading ? "Loading catalog…" : "No recent activity"}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live Event Feed */}
      <EventFeed />

      {/* Network Activity — Agent Monitor + wTAG Distribution */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Network Activity</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <AgentActivityMonitor limit={15} pollingInterval={15000} />
          <WTagDistributionTracker topN={10} pollingInterval={30000} />
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {displayTopUsers.length > 0 ? "Top Asset Owners" : "Recent batches"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {displayTopUsers.length > 0 ? (
                displayTopUsers.map((user, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Link
                      href={`/users/${user.address}`}
                      className="text-sm font-mono text-muted-foreground hover:text-primary transition-colors"
                    >
                      {shortenAddress(user.address)}
                    </Link>
                    <span className="text-sm font-medium">{user.assetCount} assets</span>
                  </div>
                ))
              ) : catalog && catalog.batches.length > 0 ? (
                catalog.batches.map((b) => (
                  <div key={b.id} className="flex items-center justify-between gap-3">
                    <Link
                      href={
                        b.templateId
                          ? `/catalog/${encodeURIComponent(b.templateId)}/batch?batch=${encodeURIComponent(b.id)}`
                          : "/catalog"
                      }
                      className="truncate text-sm font-mono text-muted-foreground hover:text-primary transition-colors"
                    >
                      {b.id}
                    </Link>
                    <span className="whitespace-nowrap text-sm">
                      {b.size} · <span className="capitalize">{b.state}</span>
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  {catalogLoading ? "Loading…" : "No batches yet"}
                </p>
              )}
              {displayTopUsers.length === 0 && (
                <Link href="/station" className="block text-xs text-primary hover:underline">
                  Open the binding station →
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Flags</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentFlags && recentFlags.length > 0 ? (
                recentFlags.map((flag, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Link
                      href={`/resolve/${flag.tokenId}`}
                      className="text-sm font-mono hover:text-primary"
                    >
                      #{flag.tokenId}
                    </Link>
                    <span className="text-sm text-muted-foreground">
                      {formatRelativeTime(flag.timestamp)}
                    </span>
                  </div>
                ))
              ) : flaggedAssets > 0 ? (
                displayRecentActivity
                  .filter((a) => a.newState === 4)
                  .slice(0, 3)
                  .map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <Link
                        href={`/assets/${item.tokenId}`}
                        className="text-sm font-mono hover:text-primary"
                      >
                        #{item.tokenId}
                      </Link>
                      <span className="text-sm text-muted-foreground">
                        {formatRelativeTime(item.timestamp)}
                      </span>
                    </div>
                  ))
              ) : (
                <p className="text-sm text-muted-foreground">No flagged assets</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">System Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Contract Status</span>
                <span className="flex items-center gap-1.5 text-sm text-green-500">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  Operational
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Catalog API</span>
                <span className={`flex items-center gap-1.5 text-sm ${stats ? "text-green-500" : catalogError ? "text-red-500" : "text-muted-foreground"}`}>
                  <span className={`w-2 h-2 rounded-full ${stats ? "bg-green-500" : catalogError ? "bg-red-500" : "bg-muted-foreground"}`} />
                  {stats ? "Live" : catalogError ? "Unavailable" : "Loading"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Indexer (subgraph)</span>
                <span className={`flex items-center gap-1.5 text-sm ${useSubgraphData ? "text-green-500" : "text-muted-foreground"}`}>
                  <span className={`w-2 h-2 rounded-full ${useSubgraphData ? "bg-green-500" : "bg-muted-foreground"}`} />
                  {useSubgraphData ? "Synced" : "Not configured"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Network</span>
                <span className="text-sm">{chainId === 84532 ? "Base Sepolia" : chainId === 421614 ? "Arbitrum Sepolia" : "OP Sepolia"}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
