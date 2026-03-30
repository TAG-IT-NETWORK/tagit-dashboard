"use client";

import { useState, useMemo } from "react";
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
  AddressBadge,
} from "@tagit/ui";
import {
  ArrowUpDown,
  Search,
  Filter,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  Ban,
  CircleDot,
  Landmark,
} from "lucide-react";
import { getExplorerTxUrl } from "@tagit/contracts";
import { useChainId } from "wagmi";
import type { SpendEvent } from "@/lib/hooks/use-treasury-spend";

// ─── Helpers ────────────────────────────────────────────────────────────

function formatRelativeTime(timestampSec: string): string {
  const seconds = Math.floor(Date.now() / 1000 - Number(timestampSec));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatAmount(wei: string): string {
  const num = Number(wei);
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toLocaleString();
}

function getEventIcon(type: SpendEvent["type"]) {
  switch (type) {
    case "deposit":
      return <ArrowDownLeft className="h-4 w-4 text-green-500" />;
    case "withdrawal_executed":
      return <ArrowUpRight className="h-4 w-4 text-red-500" />;
    case "withdrawal_queued":
      return <Clock className="h-4 w-4 text-yellow-500" />;
    case "withdrawal_canceled":
      return <Ban className="h-4 w-4 text-gray-500" />;
    case "allocation":
      return <Landmark className="h-4 w-4 text-blue-500" />;
    case "emergency_sweep":
      return <CircleDot className="h-4 w-4 text-red-600" />;
    default:
      return <CircleDot className="h-4 w-4 text-gray-400" />;
  }
}

function getEventLabel(type: SpendEvent["type"]): string {
  switch (type) {
    case "deposit": return "Deposit";
    case "withdrawal_executed": return "Spent";
    case "withdrawal_queued": return "Queued";
    case "withdrawal_canceled": return "Canceled";
    case "allocation": return "Allocation";
    case "emergency_sweep": return "Sweep";
    default: return type;
  }
}

function getEventVariant(type: SpendEvent["type"]): "default" | "destructive" | "outline" | "secondary" {
  switch (type) {
    case "deposit": return "default";
    case "withdrawal_executed": return "destructive";
    case "withdrawal_queued": return "secondary";
    case "withdrawal_canceled": return "outline";
    case "allocation": return "default";
    case "emergency_sweep": return "destructive";
    default: return "outline";
  }
}

// ─── Type Filters ───────────────────────────────────────────────────────

const typeFilters: { value: string; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "deposit", label: "Deposits" },
  { value: "withdrawal_executed", label: "Executed" },
  { value: "withdrawal_queued", label: "Queued" },
  { value: "withdrawal_canceled", label: "Canceled" },
  { value: "allocation", label: "Allocations" },
];

// ─── Column Definitions ─────────────────────────────────────────────────

function getColumns(chainId: number): ColumnDef<SpendEvent>[] {
  return [
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-full bg-muted">
            {getEventIcon(row.original.type)}
          </div>
          <Badge variant={getEventVariant(row.original.type)}>
            {getEventLabel(row.original.type)}
          </Badge>
        </div>
      ),
    },
    {
      accessorKey: "amount",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="p-0 hover:bg-transparent"
        >
          Amount
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="font-mono font-medium">
          {formatAmount(row.original.amount)}
        </span>
      ),
    },
    {
      accessorKey: "recipient",
      header: "Recipient",
      cell: ({ row }) =>
        row.original.recipient ? (
          <AddressBadge
            address={row.original.recipient}
            showCopy={false}
            showEtherscan={false}
          />
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) =>
        row.original.status ? (
          <Badge variant="outline">{row.original.status}</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      accessorKey: "timestamp",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="p-0 hover:bg-transparent"
        >
          Time
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-3 w-3" />
          {formatRelativeTime(row.original.timestamp)}
        </div>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" asChild>
          <a
            href={getExplorerTxUrl(chainId, row.original.transactionHash)}
            target="_blank"
            rel="noopener noreferrer"
            title="View on explorer"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      ),
    },
  ];
}

// ─── Component ──────────────────────────────────────────────────────────

interface SpendTableProps {
  events: SpendEvent[];
}

export function SpendTable({ events }: SpendTableProps) {
  const chainId = useChainId();
  const [sorting, setSorting] = useState<SortingState>([
    { id: "timestamp", desc: true },
  ]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");

  const columns = useMemo(() => getColumns(chainId), [chainId]);

  const filteredEvents = useMemo(() => {
    if (typeFilter === "ALL") return events;
    return events.filter((e) => e.type === typeFilter);
  }, [events, typeFilter]);

  const table = useReactTable({
    data: filteredEvents,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    state: { sorting, globalFilter },
    initialState: { pagination: { pageSize: 10 } },
  });

  return (
    <Card data-testid="spend-table">
      <CardHeader>
        <CardTitle>Spend Events</CardTitle>
        <CardDescription>
          Treasury allocations, withdrawals, and deposits
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search events..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-10"
              data-testid="spend-search"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            {typeFilters.map((filter) => (
              <Badge
                key={filter.value}
                variant={typeFilter === filter.value ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setTypeFilter(filter.value)}
                data-testid={`filter-${filter.value.toLowerCase()}`}
              >
                {filter.label}
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
                        : flexRender(header.column.columnDef.header, header.getContext())}
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
                    data-testid="spend-row"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-8 text-center text-muted-foreground"
                    data-testid="spend-table-empty"
                  >
                    No spend events found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-muted-foreground">
            Showing {table.getRowModel().rows.length} of {filteredEvents.length} events
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
  );
}
