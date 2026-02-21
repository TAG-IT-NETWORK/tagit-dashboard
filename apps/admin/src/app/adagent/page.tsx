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
} from "@tagit/ui";
import {
  Bot,
  Play,
  Database,
  Loader2,
  RefreshCw,
  Search,
  Filter,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Check,
  X,
  Users,
  Target,
  UserCheck,
  TrendingUp,
  Clock,
} from "lucide-react";
import {
  servicesApi,
  type OutreachRecord,
  type OutreachMetrics,
  type QualificationRecord,
  type OutreachStage,
} from "@/lib/services-client";
import {
  mockOutreachMetrics,
  mockOutreachRecords,
  mockQualificationScores,
  mockFunnelData,
} from "@/lib/mocks/adagent";

// ── Helpers ─────────────────────────────────────────────────────

function formatRelativeTime(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function stageLabel(stage: OutreachStage): string {
  const map: Record<OutreachStage, string> = {
    queued: "Queued",
    pitched: "Pitched",
    awaiting_response: "Awaiting",
    demo_scheduled: "Demo Sched.",
    demo_completed: "Demo Done",
    onboarded: "Onboarded",
    declined: "Declined",
    no_response: "No Response",
    error: "Error",
    cooldown: "Cooldown",
  };
  return map[stage] ?? stage;
}

function stageColor(stage: OutreachStage): string {
  const map: Record<OutreachStage, string> = {
    queued: "bg-gray-500/10 text-gray-400 border-gray-500/20",
    pitched: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    awaiting_response: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    demo_scheduled: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    demo_completed: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    onboarded: "bg-green-500/10 text-green-400 border-green-500/20",
    declined: "bg-red-500/10 text-red-400 border-red-500/20",
    no_response: "bg-gray-500/10 text-gray-400 border-gray-500/20",
    error: "bg-red-500/10 text-red-400 border-red-500/20",
    cooldown: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  };
  return map[stage] ?? "";
}

function categoryColor(cat: string): string {
  const map: Record<string, string> = {
    "e-commerce": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    "supply-chain": "bg-blue-500/10 text-blue-400 border-blue-500/20",
    "defi-rwa": "bg-purple-500/10 text-purple-400 border-purple-500/20",
    "luxury-fashion": "bg-pink-500/10 text-pink-400 border-pink-500/20",
    insurance: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    other: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  };
  return map[cat] ?? map.other!;
}

function scoreColor(score: number): string {
  if (score >= 70) return "text-green-400";
  if (score >= 50) return "text-amber-400";
  return "text-red-400";
}

// ── Table columns ───────────────────────────────────────────────

const crmColumns: ColumnDef<OutreachRecord>[] = [
  {
    accessorKey: "agentName",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="p-0 hover:bg-transparent"
      >
        Agent Name
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <div className="font-medium">{row.original.agentName ?? `Agent #${row.original.crawledAgentId}`}</div>
    ),
  },
  {
    accessorKey: "agentUrl",
    header: "URL",
    cell: ({ row }) =>
      row.original.agentUrl ? (
        <a
          href={row.original.agentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-muted-foreground hover:text-primary transition-colors truncate max-w-[200px] block"
        >
          {row.original.agentUrl.replace(/^https?:\/\//, "")}
        </a>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    accessorKey: "agentCategory",
    header: "Category",
    cell: ({ row }) => {
      const cat = row.original.agentCategory;
      return cat ? (
        <Badge variant="outline" className={categoryColor(cat)}>
          {cat}
        </Badge>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    },
  },
  {
    accessorKey: "qualificationScore",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="p-0 hover:bg-transparent"
      >
        Score
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const score = row.original.qualificationScore;
      return score != null ? (
        <span className={`font-mono font-bold ${scoreColor(score)}`}>
          {score}
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    },
  },
  {
    accessorKey: "stage",
    header: "Stage",
    cell: ({ row }) => (
      <Badge variant="outline" className={stageColor(row.original.stage)}>
        {stageLabel(row.original.stage)}
      </Badge>
    ),
  },
  {
    accessorKey: "updatedAt",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="p-0 hover:bg-transparent"
      >
        Last Contact
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {formatRelativeTime(row.original.updatedAt)}
      </span>
    ),
  },
];

// ── Stage filter options ────────────────────────────────────────

const stageFilters: { value: OutreachStage | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "queued", label: "Queued" },
  { value: "pitched", label: "Pitched" },
  { value: "awaiting_response", label: "Awaiting" },
  { value: "onboarded", label: "Onboarded" },
  { value: "declined", label: "Declined" },
];

// ── Page Component ──────────────────────────────────────────────

export default function AdAgentPage() {
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  // Data state
  const [metrics, setMetrics] = useState<OutreachMetrics[]>(mockOutreachMetrics);
  const [records, setRecords] = useState<OutreachRecord[]>(mockOutreachRecords);
  const [scores, setScores] = useState<QualificationRecord[]>(mockQualificationScores);
  const [funnel, setFunnel] = useState(mockFunnelData);

  // Table state
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [stageFilter, setStageFilter] = useState<OutreachStage | "ALL">("ALL");

  // Fetch live data
  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      setLoading(true);
      const [metricsRes, recordsRes, scoresRes] = await Promise.all([
        servicesApi.getAdagentMetrics(),
        servicesApi.getAdagentRecords({ limit: 100 }),
        servicesApi.getQualificationScores({ status: "pending_review", limit: 50 }),
      ]);

      if (cancelled) return;

      if (metricsRes.success && recordsRes.success && scoresRes.success) {
        setIsLive(true);
        setMetrics(metricsRes.data);
        setRecords(recordsRes.data);
        setScores(scoresRes.data);

        // Derive funnel from live metrics
        const demo = metricsRes.data.find((m) => m.mode === "demo") ?? metricsRes.data[0];
        if (demo) {
          setFunnel({
            crawled: demo.totalPitched + 100, // approximate
            qualified: demo.totalPitched,
            pitched: demo.totalPitched,
            demo: demo.totalDemos,
            onboarded: demo.totalOnboarded,
          });
        }
      } else {
        setIsLive(false);
      }
      setLoading(false);
    }
    fetchData();
    return () => { cancelled = true; };
  }, []);

  // Aggregate metrics across modes
  const agg = useMemo(() => {
    const totals = metrics.reduce(
      (acc, m) => ({
        crawled: acc.crawled + m.totalPitched,
        qualified: acc.qualified + m.totalResponses,
        onboarded: acc.onboarded + m.totalOnboarded,
        pitched: acc.pitched + m.totalPitched,
      }),
      { crawled: 0, qualified: 0, onboarded: 0, pitched: 0 }
    );
    const demoMode = metrics.find((m) => m.mode === "demo");
    return {
      ...totals,
      acceptRate: demoMode?.acceptRate ?? 0,
    };
  }, [metrics]);

  // Outreach queue: records at queued/pitched/awaiting_response
  const outreachQueue = useMemo(
    () =>
      records.filter((r) =>
        ["queued", "pitched", "awaiting_response"].includes(r.stage)
      ),
    [records]
  );

  // Filtered CRM data
  const filteredRecords = useMemo(() => {
    if (stageFilter === "ALL") return records;
    return records.filter((r) => r.stage === stageFilter);
  }, [records, stageFilter]);

  const table = useReactTable({
    data: filteredRecords,
    columns: crmColumns,
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
  const handleRunPipeline = async () => {
    setRunning(true);
    await servicesApi.runPipeline();
    setRunning(false);
  };

  const handleApproveScore = async (id: number) => {
    await servicesApi.approveScore(id);
    setScores((prev) => prev.filter((s) => s.id !== id));
  };

  const handleRejectScore = async (id: number) => {
    await servicesApi.rejectScore(id);
    setScores((prev) => prev.filter((s) => s.id !== id));
  };

  // Funnel max for proportional widths
  const funnelMax = Math.max(funnel.crawled, 1);

  return (
    <div className="space-y-6">
      {/* ── A) Header ──────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-6 w-6" />
            BD Agent
          </h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>Outreach pipeline &amp; agent qualification</span>
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
        <Button onClick={handleRunPipeline} disabled={running}>
          {running ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-2" />
          )}
          Run Pipeline
        </Button>
      </div>

      {/* ── B) Metrics Row ─────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Agents Crawled"
          value={funnel.crawled}
          icon={<Users className="h-5 w-5" />}
          loading={loading}
        />
        <MetricCard
          title="Qualified"
          value={funnel.qualified}
          icon={<Target className="h-5 w-5" />}
          loading={loading}
        />
        <MetricCard
          title="Onboarded This Week"
          value={funnel.onboarded}
          icon={<UserCheck className="h-5 w-5" />}
          loading={loading}
        />
        <MetricCard
          title="Accept Rate"
          value={`${agg.acceptRate.toFixed(1)}%`}
          icon={<TrendingUp className="h-5 w-5" />}
          loading={loading}
        />
      </div>

      {/* ── C) Pipeline Funnel ─────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Pipeline Funnel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { label: "Crawled", value: funnel.crawled, color: "bg-gray-500" },
              { label: "Qualified", value: funnel.qualified, color: "bg-blue-500" },
              { label: "Pitched", value: funnel.pitched, color: "bg-amber-500" },
              { label: "Demo", value: funnel.demo, color: "bg-purple-500" },
              { label: "Onboarded", value: funnel.onboarded, color: "bg-green-500" },
            ].map((step) => (
              <div key={step.label} className="flex items-center gap-3">
                <span className="w-24 text-sm text-muted-foreground text-right">
                  {step.label}
                </span>
                <div className="flex-1 h-8 bg-muted rounded-md overflow-hidden">
                  <div
                    className={`h-full ${step.color} rounded-md transition-all duration-500 flex items-center px-3`}
                    style={{
                      width: `${Math.max((step.value / funnelMax) * 100, 4)}%`,
                    }}
                  >
                    <span className="text-xs font-bold text-white">
                      {step.value}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── D) Two-Column Grid ─────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Outreach Queue */}
        <Card>
          <CardHeader>
            <CardTitle>Outreach Queue</CardTitle>
            <CardDescription>
              {outreachQueue.length} agents in active pipeline
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {outreachQueue.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No agents in queue
                </p>
              ) : (
                outreachQueue.map((rec) => (
                  <div
                    key={rec.id}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {rec.agentName ?? `Agent #${rec.crawledAgentId}`}
                        </span>
                        {rec.agentCategory && (
                          <Badge
                            variant="outline"
                            className={`text-xs ${categoryColor(rec.agentCategory)}`}
                          >
                            {rec.agentCategory}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {rec.qualificationScore != null && (
                          <span
                            className={`text-xs font-mono font-bold ${scoreColor(rec.qualificationScore)}`}
                          >
                            Score: {rec.qualificationScore}
                          </span>
                        )}
                        <Badge
                          variant="outline"
                          className={`text-xs ${stageColor(rec.stage)}`}
                        >
                          {stageLabel(rec.stage)}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatRelativeTime(rec.updatedAt)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right: Qualification Review */}
        <Card>
          <CardHeader>
            <CardTitle>Qualification Review</CardTitle>
            <CardDescription>
              {scores.length} scores pending human review
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {scores.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No scores pending review
                </p>
              ) : (
                scores.map((score) => (
                  <div
                    key={score.id}
                    className="flex items-start justify-between py-2 border-b border-border last:border-0"
                  >
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-lg font-mono font-bold ${scoreColor(score.score)}`}
                        >
                          {score.score}
                        </span>
                        <Badge
                          variant="outline"
                          className={categoryColor(score.category)}
                        >
                          {score.category}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {score.reasoning}
                      </p>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        <span>Fit: {score.capabilityFit}</span>
                        <span>Rep: {score.reputationScore}</span>
                        <span>Act: {score.activityLevel}</span>
                        <span>Cat: {score.categoryMatch}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 text-green-500 hover:text-green-400 hover:border-green-500/50"
                        onClick={() => handleApproveScore(score.id)}
                        title="Approve"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-400 hover:border-red-500/50"
                        onClick={() => handleRejectScore(score.id)}
                        title="Reject"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── E) Agent CRM Table ─────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Agent CRM</CardTitle>
          <CardDescription>
            {filteredRecords.length} outreach records
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by agent name..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              {stageFilters.map((f) => (
                <Badge
                  key={f.value}
                  variant={stageFilter === f.value ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setStageFilter(f.value)}
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
                      {crmColumns.map((_, j) => (
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
                      colSpan={crmColumns.length}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No outreach records found
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
              {filteredRecords.length} records
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
