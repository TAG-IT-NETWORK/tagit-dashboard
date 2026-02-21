"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Badge,
  Input,
  MetricCard,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@tagit/ui";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Megaphone,
  Plus,
  Database,
  Loader2,
  Search,
  Filter,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Check,
  X,
  FileText,
  Clock,
  ShieldAlert,
  ShieldOff,
  AlertTriangle,
  TrendingUp,
  CalendarDays,
  BarChart3,
} from "lucide-react";
import {
  servicesApi,
  type ContentItem,
  type ContentStatus,
  type InfluencerMetrics,
  type KillSwitchStatus,
  type Channel,
  type ChannelStatus,
} from "@/lib/services-client";
import {
  mockInfluencerMetrics,
  mockKillSwitchStatus,
  mockContentItems,
  mockEngagementChartData,
  mockChannelStatus,
} from "@/lib/mocks/influencer";

// ── Helpers ─────────────────────────────────────────────────────

function formatRelativeTime(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 0) {
    const abs = Math.abs(seconds);
    if (abs < 3600) return `in ${Math.floor(abs / 60)}m`;
    if (abs < 86400) return `in ${Math.floor(abs / 3600)}h`;
    return `in ${Math.floor(abs / 86400)}d`;
  }
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusColor(status: ContentStatus): string {
  const map: Record<ContentStatus, string> = {
    draft: "bg-gray-500/10 text-gray-400 border-gray-500/20",
    pending_review: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    approved: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    rejected: "bg-red-500/10 text-red-400 border-red-500/20",
    scheduled: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    published: "bg-green-500/10 text-green-400 border-green-500/20",
    killed: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  return map[status] ?? "";
}

function statusLabel(status: ContentStatus): string {
  const map: Record<ContentStatus, string> = {
    draft: "Draft",
    pending_review: "Pending",
    approved: "Approved",
    rejected: "Rejected",
    scheduled: "Scheduled",
    published: "Published",
    killed: "Killed",
  };
  return map[status] ?? status;
}

function typeLabel(type: string): string {
  return type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function channelLabel(ch: Channel): string {
  const map: Record<Channel, string> = {
    x: "X",
    moltbook: "Moltbook",
    farcaster: "Farcaster",
    github: "GitHub",
  };
  return map[ch] ?? ch;
}

function rateLimitColor(remaining: number | undefined): string {
  if (remaining === undefined) return "text-muted-foreground";
  if (remaining > 50) return "text-green-400";
  if (remaining > 10) return "text-amber-400";
  return "text-red-400";
}

// ── Table columns ───────────────────────────────────────────────

const contentColumns: ColumnDef<ContentItem>[] = [
  {
    accessorKey: "title",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="p-0 hover:bg-transparent"
      >
        Title
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="font-medium text-sm line-clamp-1 max-w-[300px]">
        {row.original.title}
      </span>
    ),
  },
  {
    accessorKey: "contentType",
    header: "Type",
    cell: ({ row }) => (
      <Badge variant="outline" className="text-xs">
        {typeLabel(row.original.contentType)}
      </Badge>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant="outline" className={statusColor(row.original.status)}>
        {statusLabel(row.original.status)}
      </Badge>
    ),
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="p-0 hover:bg-transparent"
      >
        Created
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {formatRelativeTime(row.original.createdAt)}
      </span>
    ),
  },
  {
    accessorKey: "scheduledAt",
    header: "Scheduled",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {formatDate(row.original.scheduledAt)}
      </span>
    ),
  },
  {
    accessorKey: "publishedAt",
    header: "Published",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {formatDate(row.original.publishedAt)}
      </span>
    ),
  },
];

// ── Status filter options ───────────────────────────────────────

const statusFilters: { value: ContentStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "pending_review", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
  { value: "rejected", label: "Rejected" },
];

// ── Page Component ──────────────────────────────────────────────

export default function InfluencerPage() {
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Data state
  const [metrics, setMetrics] = useState<InfluencerMetrics>(mockInfluencerMetrics);
  const [killSwitch, setKillSwitch] = useState<KillSwitchStatus>(mockKillSwitchStatus);
  const [content, setContent] = useState<ContentItem[]>(mockContentItems);
  const [engagementData] = useState(mockEngagementChartData);
  const [channelStatus, setChannelStatus] = useState<Record<Channel, ChannelStatus>>(mockChannelStatus);

  // Kill switch dialog
  const [killReason, setKillReason] = useState("");

  // Table state
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<ContentStatus | "ALL">("ALL");

  // Fetch live data
  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      setLoading(true);
      const [metricsRes, ksRes, contentRes, chRes] = await Promise.all([
        servicesApi.getInfluencerMetrics(),
        servicesApi.getKillSwitchStatus(),
        servicesApi.getContent({ limit: 100 }),
        servicesApi.getChannelStatus(),
      ]);

      if (cancelled) return;

      if (metricsRes.success && ksRes.success && contentRes.success) {
        setIsLive(true);
        setMetrics(metricsRes.data);
        setKillSwitch(ksRes.data);
        setContent(contentRes.data);
        if (chRes.success) setChannelStatus(chRes.data);
      } else {
        setIsLive(false);
      }
      setLoading(false);
    }
    fetchData();
    return () => { cancelled = true; };
  }, []);

  // Pending review items
  const pendingItems = useMemo(
    () => content.filter((c) => c.status === "pending_review"),
    [content]
  );

  // Calendar items: scheduled + approved (upcoming)
  const calendarItems = useMemo(
    () =>
      content
        .filter((c) => ["scheduled", "approved"].includes(c.status) && c.scheduledAt)
        .sort(
          (a, b) =>
            new Date(a.scheduledAt!).getTime() -
            new Date(b.scheduledAt!).getTime()
        ),
    [content]
  );

  // Filtered content for table
  const filteredContent = useMemo(() => {
    if (statusFilter === "ALL") return content;
    return content.filter((c) => c.status === statusFilter);
  }, [content, statusFilter]);

  const table = useReactTable({
    data: filteredContent,
    columns: contentColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    state: { sorting, globalFilter },
    initialState: { pagination: { pageSize: 10 } },
  });

  // Actions
  const handleGenerate = async () => {
    setGenerating(true);
    const res = await servicesApi.generateContent("weekly_report");
    if (res.success) {
      setContent((prev) => [res.data.content, ...prev]);
    }
    setGenerating(false);
  };

  const handleApproveContent = async (id: number) => {
    await servicesApi.approveContent(id);
    setContent((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: "approved" as const } : c))
    );
  };

  const handleRejectContent = async (id: number) => {
    await servicesApi.rejectContent(id, "Rejected by admin");
    setContent((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: "rejected" as const } : c))
    );
  };

  const handleActivateKillSwitch = async () => {
    if (!killReason.trim()) return;
    await servicesApi.activateKillSwitch(killReason);
    setKillSwitch({
      active: true,
      activatedBy: "admin",
      activatedAt: new Date().toISOString(),
      reason: killReason,
    });
    setKillReason("");
  };

  const handleDeactivateKillSwitch = async () => {
    await servicesApi.deactivateKillSwitch();
    setKillSwitch({
      active: false,
      deactivatedBy: "admin",
      deactivatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="space-y-6">
      {/* ── A) Header ──────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="h-6 w-6" />
            Influencer
          </h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>Content management &amp; engagement</span>
            {isLive ? (
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
          {/* Kill Switch Toggle */}
          {!killSwitch.active && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <ShieldAlert className="h-4 w-4 mr-2" />
                  Kill Switch
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Activate Kill Switch</DialogTitle>
                  <DialogDescription>
                    This will immediately halt all content generation, scheduling, and publishing. Are you sure?
                  </DialogDescription>
                </DialogHeader>
                <Input
                  placeholder="Reason for activation..."
                  value={killReason}
                  onChange={(e) => setKillReason(e.target.value)}
                />
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button
                      variant="destructive"
                      onClick={handleActivateKillSwitch}
                      disabled={!killReason.trim()}
                    >
                      Activate
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          <Button onClick={handleGenerate} disabled={generating || killSwitch.active}>
            {generating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Generate Content
          </Button>
        </div>
      </div>

      {/* ── B) Kill Switch Banner ──────────────────────── */}
      {killSwitch.active && (
        <div className="flex items-center justify-between p-4 rounded-lg bg-red-500/10 border border-red-500/30">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-6 w-6 text-red-500" />
            <div>
              <p className="font-semibold text-red-500">Kill Switch Active</p>
              <p className="text-sm text-red-400">
                {killSwitch.reason ?? "All content operations halted"}
                {killSwitch.activatedAt && (
                  <> — activated {formatRelativeTime(killSwitch.activatedAt)}</>
                )}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            className="border-red-500/50 text-red-400 hover:bg-red-500/10"
            onClick={handleDeactivateKillSwitch}
          >
            <ShieldOff className="h-4 w-4 mr-2" />
            Deactivate
          </Button>
        </div>
      )}

      {/* ── C) Metrics Row ─────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Published"
          value={metrics.totalPublished}
          icon={<FileText className="h-5 w-5" />}
          loading={loading}
        />
        <MetricCard
          title="Pending Review"
          value={metrics.pendingReview}
          icon={<Clock className="h-5 w-5" />}
          className={metrics.pendingReview > 0 ? "border-amber-500/50" : ""}
          loading={loading}
        />
        <MetricCard
          title="Approval Rate"
          value={
            metrics.totalGenerated > 0
              ? `${((metrics.totalApproved / metrics.totalGenerated) * 100).toFixed(0)}%`
              : "—"
          }
          icon={<TrendingUp className="h-5 w-5" />}
          loading={loading}
        />
        <MetricCard
          title="Kill Switch"
          value={killSwitch.active ? "ACTIVE" : "Inactive"}
          icon={<ShieldAlert className="h-5 w-5" />}
          className={killSwitch.active ? "border-red-500/50" : ""}
          loading={loading}
        />
      </div>

      {/* ── D) Two-Column Grid ─────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Approval Queue */}
        <Card>
          <CardHeader>
            <CardTitle>Approval Queue</CardTitle>
            <CardDescription>
              {pendingItems.length} items pending review
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {pendingItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No content pending review
                </p>
              ) : (
                pendingItems.map((item) => (
                  <div
                    key={item.id}
                    className="py-3 border-b border-border last:border-0"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm truncate">
                            {item.title}
                          </span>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {typeLabel(item.contentType)}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {item.body}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0 text-green-500 hover:text-green-400 hover:border-green-500/50"
                          onClick={() => handleApproveContent(item.id)}
                          title="Approve"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-400 hover:border-red-500/50"
                          onClick={() => handleRejectContent(item.id)}
                          title="Reject"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right: Content Calendar */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Content Calendar
            </CardTitle>
            <CardDescription>
              {calendarItems.length} upcoming items
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {calendarItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No scheduled content
                </p>
              ) : (
                calendarItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="font-medium text-sm truncate">
                        {item.title}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {typeLabel(item.contentType)}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={statusColor(item.status)}
                        >
                          {statusLabel(item.status)}
                        </Badge>
                      </div>
                    </div>
                    <span className="text-sm text-muted-foreground shrink-0 ml-2">
                      {formatDate(item.scheduledAt)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── E) Engagement Metrics ──────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Engagement Metrics
          </CardTitle>
          <CardDescription>
            Per-channel impressions, clicks, and conversions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={engagementData}>
                <XAxis
                  dataKey="channel"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                />
                <YAxis
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload?.length) {
                      return (
                        <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg">
                          <p className="font-medium mb-1">{label}</p>
                          {payload.map((p) => (
                            <p
                              key={p.name}
                              className="text-sm"
                              style={{ color: p.color }}
                            >
                              {p.name}: {Number(p.value).toLocaleString()}
                            </p>
                          ))}
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
                <Bar dataKey="impressions" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="clicks" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="conversions" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Channel Rate Limits */}
          <div className="grid gap-3 md:grid-cols-4">
            {(Object.keys(channelStatus) as Channel[]).map((ch) => {
              const cs = channelStatus[ch];
              return (
                <div
                  key={ch}
                  className="flex items-center justify-between p-3 rounded-lg border border-border"
                >
                  <div>
                    <p className="text-sm font-medium">{channelLabel(ch)}</p>
                    <p className="text-xs text-muted-foreground">
                      {cs?.connected ? "Connected" : "Disconnected"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-mono font-bold ${rateLimitColor(cs?.rateLimitRemaining)}`}
                    >
                      {cs?.rateLimitRemaining ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">remaining</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── F) Content Table ───────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Content Library</CardTitle>
          <CardDescription>
            {filteredContent.length} content items
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              {statusFilters.map((f) => (
                <Badge
                  key={f.value}
                  variant={statusFilter === f.value ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setStatusFilter(f.value)}
                >
                  {f.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <table className="w-full">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} className="border-b bg-muted/50">
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="px-4 py-3 text-left text-sm font-medium text-muted-foreground"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      {contentColumns.map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-5 w-24 animate-pulse bg-muted rounded" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : table.getRowModel().rows.length ? (
                  table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b hover:bg-muted/50 transition-colors"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-3">
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={contentColumns.length}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No content found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Showing {table.getRowModel().rows.length} of{" "}
              {filteredContent.length} items
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">
                Page {table.getState().pagination.pageIndex + 1} of{" "}
                {table.getPageCount()}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
