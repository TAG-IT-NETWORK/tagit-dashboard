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
  AddressBadge,
} from "@tagit/ui";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  Search,
  Filter,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  AlertTriangle,
  PieChart,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  FileText,
} from "lucide-react";
import {
  mockTreasuryReserves,
  mockTreasuryTransactions,
  getTreasuryStats,
  getTokenColor,
  type TreasuryTransaction,
} from "@/lib/mocks/treasury";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
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

const transactionColumns: ColumnDef<TreasuryTransaction>[] = [
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        {row.original.type === "inflow" ? (
          <div className="p-1.5 rounded-full bg-green-500/10">
            <ArrowDownLeft className="h-4 w-4 text-green-500" />
          </div>
        ) : (
          <div className="p-1.5 rounded-full bg-red-500/10">
            <ArrowUpRight className="h-4 w-4 text-red-500" />
          </div>
        )}
        <span
          className={
            row.original.type === "inflow" ? "text-green-500" : "text-red-500"
          }
        >
          {row.original.type === "inflow" ? "Inflow" : "Outflow"}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => (
      <div className="max-w-[200px]">
        <p className="font-medium truncate">{row.original.description}</p>
        {row.original.proposalId && (
          <Link
            href={`/governance/${row.original.proposalId}`}
            className="text-xs text-primary hover:underline"
          >
            Proposal #{row.original.proposalId}
          </Link>
        )}
      </div>
    ),
  },
  {
    accessorKey: "token",
    header: "Token",
    cell: ({ row }) => (
      <Badge
        variant="outline"
        style={{
          borderColor: `${getTokenColor(row.original.token)}50`,
          color: getTokenColor(row.original.token),
        }}
      >
        {row.original.token}
      </Badge>
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
      <span className="font-mono">
        {formatNumber(row.original.amount, 4)} {row.original.token}
      </span>
    ),
  },
  {
    accessorKey: "valueUSD",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="p-0 hover:bg-transparent"
      >
        Value
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="font-medium">{formatCurrency(row.original.valueUSD)}</span>
    ),
  },
  {
    accessorKey: "to",
    header: "Recipient",
    cell: ({ row }) => (
      <AddressBadge
        address={row.original.type === "inflow" ? row.original.to : row.original.to}
        showCopy={false}
        showEtherscan={false}
      />
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
          href={`https://etherscan.io/tx/${row.original.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </Button>
    ),
  },
];

const typeFilters: { value: string; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "inflow", label: "Inflows" },
  { value: "outflow", label: "Outflows" },
];

function ReserveBreakdown() {
  const totalValue = mockTreasuryReserves.reduce((sum, r) => sum + r.valueUSD, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PieChart className="h-5 w-5" />
          Reserve Breakdown
        </CardTitle>
        <CardDescription>Distribution of treasury assets</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Visual bar representation */}
        <div className="h-4 rounded-full overflow-hidden flex">
          {mockTreasuryReserves.map((reserve) => (
            <div
              key={reserve.symbol}
              style={{
                width: `${reserve.percentage}%`,
                backgroundColor: getTokenColor(reserve.symbol),
              }}
              className="first:rounded-l-full last:rounded-r-full"
              title={`${reserve.symbol}: ${reserve.percentage}%`}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 gap-4">
          {mockTreasuryReserves.map((reserve) => (
            <div
              key={reserve.symbol}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: getTokenColor(reserve.symbol) }}
                />
                <div>
                  <p className="font-medium">{reserve.symbol}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatNumber(reserve.balance, 2)} tokens
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium">{formatCurrency(reserve.valueUSD)}</p>
                <p className="text-xs text-muted-foreground">{reserve.percentage}%</p>
              </div>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between">
            <span className="text-lg font-medium">Total Value</span>
            <span className="text-2xl font-bold">{formatCurrency(totalValue)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TreasuryPage() {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "timestamp", desc: true },
  ]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");

  const stats = getTreasuryStats();

  const filteredTransactions = useMemo(() => {
    if (typeFilter === "ALL") return mockTreasuryTransactions;
    return mockTreasuryTransactions.filter((tx) => tx.type === typeFilter);
  }, [typeFilter]);

  const table = useReactTable({
    data: filteredTransactions,
    columns: transactionColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      globalFilter,
    },
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" />
            Treasury
          </h1>
          <p className="text-muted-foreground">
            Protocol treasury reserves and transaction history
          </p>
        </div>
        <Link href="/governance/new">
          <Button>
            <FileText className="h-4 w-4 mr-2" />
            Create Proposal
          </Button>
        </Link>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Value"
          value={formatCurrency(stats.totalValueUSD)}
          icon={<Wallet className="h-5 w-5" />}
          className="border-primary/50"
        />
        <MetricCard
          title="30d Inflows"
          value={formatCurrency(stats.totalInflows30d)}
          icon={<TrendingUp className="h-5 w-5 text-green-500" />}
          className="border-green-500/50"
        />
        <MetricCard
          title="30d Outflows"
          value={formatCurrency(stats.totalOutflows30d)}
          icon={<TrendingDown className="h-5 w-5 text-red-500" />}
          className="border-red-500/50"
        />
        <MetricCard
          title="Net Change (30d)"
          value={formatCurrency(Math.abs(stats.netChange30d))}
          icon={
            stats.netChange30d >= 0 ? (
              <TrendingUp className="h-5 w-5 text-green-500" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-500" />
            )
          }
          className={
            stats.netChange30d >= 0 ? "border-green-500/50" : "border-red-500/50"
          }
        />
      </div>

      {/* Reserve Breakdown */}
      <ReserveBreakdown />

      {/* Demo Mode Indicator */}
      <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
        <AlertTriangle className="h-4 w-4 text-yellow-600" />
        <span className="text-sm text-yellow-600">
          Demo Mode: Using mock data. Connect to deployed contracts for live treasury data.
        </span>
      </div>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>
            Recent treasury inflows and outflows
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search transactions..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Type Filter */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              {typeFilters.map((filter) => (
                <Badge
                  key={filter.value}
                  variant={typeFilter === filter.value ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setTypeFilter(filter.value)}
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
                      colSpan={transactionColumns.length}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No transactions found.
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
              {filteredTransactions.length} transactions
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
