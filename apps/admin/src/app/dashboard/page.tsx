"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  useTotalSupply,
  useDashboardData,
  shortenAddress,
  getBlockscoutTxUrl,
  type StateDistribution,
  type ActivityItem,
  type TopUser,
} from "@tagit/contracts";
import { WagmiGuard } from "@/components/wagmi-guard";
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
  Users,
  AlertTriangle,
  TrendingUp,
  Plus,
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

// Fallback mock data - used when subgraph is not available
const mockStateDistribution: StateDistribution[] = [
  { name: "Minted", value: 45, state: 0 },
  { name: "Bound", value: 120, state: 1 },
  { name: "Activated", value: 280, state: 2 },
  { name: "Claimed", value: 95, state: 3 },
  { name: "Flagged", value: 12, state: 4 },
  { name: "Recycled", value: 8, state: 5 },
];

const stateColors: Record<number, string> = {
  0: "#6b7280",
  1: "#3b82f6",
  2: "#22c55e",
  3: "#a855f7",
  4: "#ef4444",
  5: "#f97316",
};

const mockRecentActivity: ActivityItem[] = [
  {
    tokenId: "1234",
    oldState: 2,
    newState: 3,
    timestamp: Date.now() - 1000 * 60 * 5,
    txHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  },
  {
    tokenId: "1235",
    oldState: 1,
    newState: 2,
    timestamp: Date.now() - 1000 * 60 * 15,
    txHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  },
  {
    tokenId: "1236",
    oldState: 0,
    newState: 1,
    timestamp: Date.now() - 1000 * 60 * 30,
    txHash: "0x567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234",
  },
  {
    tokenId: "1237",
    oldState: 2,
    newState: 4,
    timestamp: Date.now() - 1000 * 60 * 45,
    txHash: "0x890abcdef1234567890abcdef1234567890abcdef1234567890abcdef123456",
  },
  {
    tokenId: "1238",
    oldState: 1,
    newState: 2,
    timestamp: Date.now() - 1000 * 60 * 60,
    txHash: "0xcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab",
  },
];

const mockTopUsers: TopUser[] = [
  { address: "0x1234567890abcdef1234567890abcdef12345678", assetCount: 234 },
  { address: "0xabcdef1234567890abcdef1234567890abcdef01", assetCount: 189 },
  { address: "0x9876543210fedcba9876543210fedcba98765432", assetCount: 145 },
];

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

  // Use subgraph data or fallback to mock/contract data
  const useSubgraphData = !subgraphError && globalStats;

  const totalAssets = useSubgraphData
    ? globalStats.totalAssets
    : totalSupply
      ? Number(totalSupply)
      : 560;

  const displayDailyMints = useSubgraphData && dailyMints !== null ? dailyMints : 23;
  const displayActiveUsers = useSubgraphData && activeUsers !== null ? activeUsers : 145;
  const displayStateDistribution = useSubgraphData && stateDistribution
    ? stateDistribution
    : mockStateDistribution;
  const displayRecentActivity = useSubgraphData && recentActivity
    ? recentActivity
    : mockRecentActivity;
  const displayTopUsers = useSubgraphData && topUsers
    ? topUsers
    : mockTopUsers;

  const flaggedAssets = displayStateDistribution.find((s) => s.state === 4)?.value ?? 0;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
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
                Live
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">
                Mock Data
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
          <Button variant="outline" asChild>
            <Link href="/resolve">
              <AlertTriangle className="h-4 w-4 mr-2" />
              View Flagged ({flaggedAssets})
            </Link>
          </Button>
          <Button asChild>
            <Link href="/assets?action=mint">
              <Plus className="h-4 w-4 mr-2" />
              Mint Asset
            </Link>
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Assets"
          value={totalAssets.toLocaleString()}
          change={useSubgraphData ? undefined : 12}
          icon={<Package className="h-5 w-5" />}
          loading={supplyLoading || subgraphLoading}
        />
        <MetricCard
          title="Daily Mints"
          value={displayDailyMints}
          change={useSubgraphData ? undefined : 8}
          icon={<TrendingUp className="h-5 w-5" />}
          loading={subgraphLoading}
        />
        <MetricCard
          title="Active Users (7d)"
          value={displayActiveUsers}
          change={useSubgraphData ? undefined : -3}
          icon={<Users className="h-5 w-5" />}
          loading={subgraphLoading}
        />
        <MetricCard
          title="Flagged Assets"
          value={flaggedAssets}
          icon={<AlertTriangle className="h-5 w-5" />}
          className={flaggedAssets > 0 ? "border-red-500/50" : ""}
          loading={subgraphLoading}
        />
      </div>

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
                        href={getBlockscoutTxUrl(activity.txHash)}
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
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No recent activity
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Asset Owners</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {displayTopUsers.map((user, i) => (
                <div key={i} className="flex items-center justify-between">
                  <Link
                    href={`/users/${user.address}`}
                    className="text-sm font-mono text-muted-foreground hover:text-primary transition-colors"
                  >
                    {shortenAddress(user.address)}
                  </Link>
                  <span className="text-sm font-medium">{user.assetCount} assets</span>
                </div>
              ))}
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
                <span className="text-sm text-muted-foreground">Subgraph</span>
                <span className={`flex items-center gap-1.5 text-sm ${useSubgraphData ? "text-green-500" : "text-yellow-500"}`}>
                  <span className={`w-2 h-2 rounded-full ${useSubgraphData ? "bg-green-500" : "bg-yellow-500"}`} />
                  {useSubgraphData ? "Synced" : "Pending"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Network</span>
                <span className="text-sm">OP Sepolia</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
