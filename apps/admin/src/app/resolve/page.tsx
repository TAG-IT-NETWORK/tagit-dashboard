"use client";

export const dynamic = "force-dynamic";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
} from "@tanstack/react-table";
// Development mode: RequireCapability disabled while wagmi context issue is being debugged
// import { RequireCapability } from "@tagit/auth";
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
  StateBadge,
  AddressBadge,
  PriorityBadge,
  calculatePriority,
  formatTimeOpen,
  type Priority,
} from "@tagit/ui";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  Search,
  Filter,
  AlertTriangle,
  Clock,
  CheckCircle,
  Timer,
  Flag,
  Shield,
} from "lucide-react";
import {
  mockFlaggedAssets,
  getFlagQueueStats,
  type FlaggedAsset,
} from "@/lib/mocks/flagged-assets";

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

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

const columns: ColumnDef<FlaggedAsset & { priority: Priority }>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <input
        type="checkbox"
        checked={table.getIsAllPageRowsSelected()}
        onChange={(e) => table.toggleAllPageRowsSelected(e.target.checked)}
        className="rounded border-gray-300"
      />
    ),
    cell: ({ row }) => (
      <input
        type="checkbox"
        checked={row.getIsSelected()}
        onChange={(e) => row.toggleSelected(e.target.checked)}
        className="rounded border-gray-300"
      />
    ),
    enableSorting: false,
  },
  {
    accessorKey: "tokenId",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="p-0 hover:bg-transparent"
      >
        Token ID
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <Link
        href={`/resolve/${row.original.tokenId}`}
        className="font-mono font-medium hover:text-primary transition-colors"
      >
        #{row.original.tokenId}
      </Link>
    ),
  },
  {
    accessorKey: "flagReason",
    header: "Flag Reason",
    cell: ({ row }) => (
      <div
        className="max-w-[200px] truncate text-sm"
        title={row.original.flagReason}
      >
        {row.original.flagReason}
      </div>
    ),
  },
  {
    accessorKey: "flaggedBy",
    header: "Flagged By",
    cell: ({ row }) => (
      <AddressBadge
        address={row.original.flaggedBy}
        showCopy={false}
        showEtherscan={false}
      />
    ),
  },
  {
    accessorKey: "flaggedAt",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="p-0 hover:bg-transparent"
      >
        Flagged At
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <div
        className="text-sm text-muted-foreground"
        title={new Date(row.original.flaggedAt).toLocaleString()}
      >
        {formatRelativeTime(row.original.flaggedAt)}
      </div>
    ),
  },
  {
    accessorKey: "timeOpen",
    header: "Time Open",
    cell: ({ row }) => (
      <div className="text-sm font-mono">
        {formatTimeOpen(row.original.flaggedAt)}
      </div>
    ),
  },
  {
    accessorKey: "priority",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="p-0 hover:bg-transparent"
      >
        Priority
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => <PriorityBadge priority={row.original.priority} />,
    sortingFn: (rowA, rowB) => {
      const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return (
        priorityOrder[rowA.original.priority] -
        priorityOrder[rowB.original.priority]
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <Link href={`/resolve/${row.original.tokenId}`}>
        <Button variant="outline" size="sm">
          Review
        </Button>
      </Link>
    ),
  },
];

const priorityFilters: { value: Priority | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
];

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <div className="p-4 rounded-full bg-red-500/10">
        <Shield className="h-12 w-12 text-red-500" />
      </div>
      <h1 className="text-2xl font-bold">Access Denied</h1>
      <p className="text-muted-foreground text-center max-w-md">
        You need the RESOLVER capability to access the resolution queue.
        Contact an administrator to request access.
      </p>
      <Link href="/dashboard">
        <Button variant="outline">Return to Dashboard</Button>
      </Link>
    </div>
  );
}

function FlagQueueContent() {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "flaggedAt", desc: false }, // Oldest first by default
  ]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "ALL">("ALL");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const stats = getFlagQueueStats();

  // Add priority to each asset
  const assetsWithPriority = useMemo(() => {
    return mockFlaggedAssets.map((asset) => ({
      ...asset,
      priority: calculatePriority(asset.flaggedAt),
    }));
  }, []);

  // Filter by priority
  const filteredData = useMemo(() => {
    if (priorityFilter === "ALL") return assetsWithPriority;
    return assetsWithPriority.filter((a) => a.priority === priorityFilter);
  }, [assetsWithPriority, priorityFilter]);

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      globalFilter,
      rowSelection,
    },
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  const selectedCount = Object.keys(rowSelection).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Flag className="h-6 w-6 text-red-500" />
            Resolution Queue
          </h1>
          <p className="text-muted-foreground">
            Review and resolve flagged assets through AIRP
          </p>
        </div>
        {selectedCount > 0 && (
          <Button variant="outline">
            Bulk Resolve ({selectedCount} selected)
          </Button>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Flagged"
          value={stats.totalFlagged}
          icon={<AlertTriangle className="h-5 w-5" />}
          className="border-red-500/50"
        />
        <MetricCard
          title="Pending Review"
          value={stats.pendingReview}
          icon={<Clock className="h-5 w-5" />}
          className={stats.pendingReview > 0 ? "border-yellow-500/50" : ""}
        />
        <MetricCard
          title="Resolved Today"
          value={stats.resolvedToday}
          icon={<CheckCircle className="h-5 w-5" />}
        />
        <MetricCard
          title="Avg Resolution Time"
          value={formatDuration(stats.avgResolutionTimeMs)}
          icon={<Timer className="h-5 w-5" />}
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by Token ID, reason, or address..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Priority Filter */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              {priorityFilters.map((filter) => (
                <Badge
                  key={filter.value}
                  variant={priorityFilter === filter.value ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setPriorityFilter(filter.value)}
                >
                  {filter.label}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Demo Mode Indicator */}
      <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
        <AlertTriangle className="h-4 w-4 text-yellow-600" />
        <span className="text-sm text-yellow-600">
          Demo Mode: Using mock data. Connect to deployed contracts for live data.
        </span>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Flagged Assets</CardTitle>
          <CardDescription>
            {filteredData.length} assets awaiting resolution
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                {table.getRowModel().rows.length ? (
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
                      colSpan={columns.length}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No flagged assets found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Showing {table.getRowModel().rows.length} of {filteredData.length}{" "}
              flagged assets
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

export default function ResolvePage() {
  // Development mode: Skip capability check while wagmi context issue is being debugged
  // TODO: Re-enable RequireCapability when wagmi integration is fixed
  return <FlagQueueContent />;
}
