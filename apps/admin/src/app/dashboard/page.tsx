"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useTotalSupply, AssetState, AssetStateNames } from "@tagit/contracts";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  MetricCard,
  Button,
  StateBadge,
  AddressBadge,
  Badge,
} from "@tagit/ui";
import { Package, Users, AlertTriangle, TrendingUp, Plus, ArrowRight, ExternalLink, FlaskConical, Nfc, Play } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

// Mock data for demonstration - in production, fetch from events/indexer
const mockStateDistribution = [
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

const mockRecentActivity = [
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

function truncateHash(hash: string): string {
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

export default function DashboardPage() {
  const { data: totalSupply, isLoading: supplyLoading } = useTotalSupply();

  const totalAssets = totalSupply ? Number(totalSupply) : 560;
  const dailyMints = 23; // Mock - would come from event indexing
  const activeUsers = 145; // Mock - would come from event indexing
  const flaggedAssets = mockStateDistribution.find((s) => s.state === 4)?.value ?? 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Overview of the TAG IT Network</p>
        </div>
        <div className="flex items-center gap-2">
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
          change={12}
          icon={<Package className="h-5 w-5" />}
          loading={supplyLoading}
        />
        <MetricCard
          title="Daily Mints"
          value={dailyMints}
          change={8}
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <MetricCard
          title="Active Users"
          value={activeUsers}
          change={-3}
          icon={<Users className="h-5 w-5" />}
        />
        <MetricCard
          title="Flagged Assets"
          value={flaggedAssets}
          icon={<AlertTriangle className="h-5 w-5" />}
          className={flaggedAssets > 0 ? "border-red-500/50" : ""}
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
                    data={mockStateDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {mockStateDistribution.map((entry) => (
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
                              {data.value} assets ({((data.value / totalAssets) * 100).toFixed(1)}%)
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend
                    formatter={(value, entry) => (
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
              {mockRecentActivity.map((activity, i) => (
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
                      href={`https://optimism-sepolia.blockscout.com/tx/${activity.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-foreground transition-colors"
                      title={activity.txHash}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Manufacturers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { address: "0x1234...5678", count: 234 },
                { address: "0xabcd...ef01", count: 189 },
                { address: "0x9876...5432", count: 145 },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <code className="text-sm text-muted-foreground">{item.address}</code>
                  <span className="text-sm font-medium">{item.count} assets</span>
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
              {flaggedAssets > 0 ? (
                mockRecentActivity
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
                <span className="text-sm text-muted-foreground">Network</span>
                <span className="text-sm">OP Sepolia</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Last Block</span>
                <span className="text-sm font-mono">#12,345,678</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
