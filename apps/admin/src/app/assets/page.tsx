"use client";

export const dynamic = "force-dynamic";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Badge,
  StateBadge,
  AddressBadge,
} from "@tagit/ui";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  Search,
  Download,
  Filter,
  Plus,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { useAllAssets, type Asset as ContractAsset, shortenAddress } from "@tagit/contracts";
import { WagmiGuard } from "@/components/wagmi-guard";

// Simple skeleton component for loading states
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className ?? ""}`} />;
}

// Table row type - mapped from contract Asset
interface AssetRow {
  tokenId: string;
  state: number;
  owner: string;
  tagId: string | null;
  createdAt: number;
  updatedAt: number;
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

function truncateHex(hex: string, chars = 6): string {
  if (hex.length <= chars * 2 + 2) return hex;
  return `${hex.slice(0, chars + 2)}...${hex.slice(-chars)}`;
}

// Transform contract Asset to table row format
function toAssetRow(asset: ContractAsset & { tokenId: bigint }): AssetRow {
  return {
    tokenId: asset.tokenId.toString(),
    state: asset.state,
    owner: asset.owner,
    tagId: null, // Tag lookup requires separate per-asset contract call
    createdAt: Number(asset.timestamp) * 1000, // Convert from seconds to ms
    updatedAt: Number(asset.timestamp) * 1000,
  };
}

const columns: ColumnDef<AssetRow>[] = [
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
        href={`/assets/${row.original.tokenId}`}
        className="font-mono font-medium hover:text-primary transition-colors"
      >
        #{row.original.tokenId}
      </Link>
    ),
  },
  {
    accessorKey: "state",
    header: "State",
    cell: ({ row }) => <StateBadge state={row.original.state} />,
    filterFn: (row, id, filterValue: number[]) => {
      if (!filterValue || filterValue.length === 0) return true;
      return filterValue.includes(row.original.state);
    },
  },
  {
    accessorKey: "owner",
    header: "Owner",
    cell: ({ row }) => (
      <Link
        href={`/users/${row.original.owner}`}
        className="hover:text-primary transition-colors"
      >
        <code className="text-sm">{row.original.owner}</code>
      </Link>
    ),
  },
  {
    accessorKey: "tagId",
    header: "Tag ID",
    cell: ({ row }) =>
      row.original.tagId ? (
        <code className="text-sm text-muted-foreground">
          {truncateHex(row.original.tagId)}
        </code>
      ) : (
        <span className="text-muted-foreground text-sm">Unbound</span>
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
    accessorKey: "updatedAt",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="p-0 hover:bg-transparent"
      >
        Updated
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

const stateFilters = [
  { value: 0, label: "Minted" },
  { value: 1, label: "Bound" },
  { value: 2, label: "Activated" },
  { value: 3, label: "Claimed" },
  { value: 4, label: "Flagged" },
  { value: 5, label: "Recycled" },
];

export default function AssetsPage() {
  return (
    <WagmiGuard>
      <AssetsContent />
    </WagmiGuard>
  );
}

function AssetsContent() {
  const [page, setPage] = useState(0);
  const pageSize = 25;

  // Fetch live data from contract
  const {
    assets: contractAssets,
    totalSupply,
    totalPages,
    hasNextPage,
    hasPrevPage,
    isLoading,
    error,
    refetch,
  } = useAllAssets({ page, pageSize, refetchInterval: 30000 }); // Auto-refresh every 30s

  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [stateFilter, setStateFilter] = useState<number[]>([]);
  const [rowSelection, setRowSelection] = useState({});

  // Transform contract assets to table rows
  const allAssets = useMemo(
    () => contractAssets.map(toAssetRow),
    [contractAssets]
  );

  // Apply state filter client-side
  const filteredData = useMemo(() => {
    if (stateFilter.length === 0) return allAssets;
    return allAssets.filter((asset) => stateFilter.includes(asset.state));
  }, [allAssets, stateFilter]);

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      globalFilter,
      rowSelection,
    },
  });

  const toggleStateFilter = (state: number) => {
    setStateFilter((prev) =>
      prev.includes(state) ? prev.filter((s) => s !== state) : [...prev, state]
    );
  };

  const exportCSV = () => {
    const rows = table.getFilteredRowModel().rows;
    const headers = ["Token ID", "State", "Owner", "Tag ID", "Created", "Updated"];
    const data = rows.map((row) => [
      row.original.tokenId,
      stateFilters.find((s) => s.value === row.original.state)?.label ?? "Unknown",
      row.original.owner,
      row.original.tagId ?? "",
      new Date(row.original.createdAt).toISOString(),
      new Date(row.original.updatedAt).toISOString(),
    ]);

    const csv = [headers, ...data].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `assets-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Assets</h1>
          <p className="text-muted-foreground">
            {isLoading ? (
              "Loading assets..."
            ) : (
              <>Total: {totalSupply.toLocaleString()} assets on the network</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
          <Button asChild>
            <Link href="/assets?action=mint">
              <Plus className="h-4 w-4 mr-2" />
              Mint Asset
            </Link>
          </Button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive text-sm">
              Error loading assets: {error.message}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by Token ID, Owner, or Tag ID..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* State Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="h-4 w-4 text-muted-foreground" />
              {stateFilters.map((filter) => (
                <Badge
                  key={filter.value}
                  variant={stateFilter.includes(filter.value) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleStateFilter(filter.value)}
                >
                  {filter.label}
                </Badge>
              ))}
              {stateFilter.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStateFilter([])}
                  className="text-xs"
                >
                  Clear
                </Button>
              )}
            </div>

            {/* Export */}
            <Button variant="outline" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
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
                {isLoading ? (
                  // Loading skeleton
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      <td className="px-4 py-3"><Skeleton className="h-5 w-16" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-20" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-32" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-28" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-16" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-16" /></td>
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
                    >
                      {totalSupply === 0 ? "No assets minted yet." : "No assets match your filters."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              {isLoading ? (
                <Skeleton className="h-4 w-40 inline-block" />
              ) : (
                <>
                  Showing {filteredData.length} of {totalSupply} assets
                  {stateFilter.length > 0 && " (filtered)"}
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(0)}
                disabled={!hasPrevPage || isLoading}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={!hasPrevPage || isLoading}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">
                Page {page + 1} of {Math.max(1, totalPages)}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={!hasNextPage || isLoading}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.max(0, totalPages - 1))}
                disabled={!hasNextPage || isLoading}
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
