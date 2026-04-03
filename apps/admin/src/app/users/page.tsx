"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePublicClient, useChainId } from "wagmi";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { Card, CardContent, Button, Input, Badge, AddressBadge } from "@tagit/ui";
import {
  getContractsForChain,
  IdentityBadgeABI,
  CapabilityBadgeABI,
  BadgeIds,
  BadgeIdNames,
  CapabilityIds,
  CapabilityIdNames,
  type CapabilityKey,
} from "@tagit/contracts";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  Search,
  Download,
  Filter,
  Shield,
  Award,
  Loader2,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

// Known badge holder addresses on the network
const KNOWN_ADDRESSES: readonly `0x${string}`[] = [
  "0x458B4d0c3a55006965Fd13D6af7B8509De51Cb3D", // Deployer — all badges + caps
  "0x92C438dd4E806439e422f82d20047c1D168a1154", // TAG IT Network — KYC + RESOLVER
  "0xd2Af1892FFcDeDE9E91d7780166bac505A2D5fcd", // Resolver 2 — KYC + RESOLVER
  "0xDb8ACD440Ef32a4D23AD685Dd64aC386b0d3d63F", // SAGE agent wallet
] as const;

const IDENTITY_BADGE_IDS = [
  BadgeIds.KYC_L1,
  BadgeIds.KYC_L2,
  BadgeIds.KYC_L3,
  BadgeIds.MANUFACTURER,
  BadgeIds.RETAILER,
  BadgeIds.GOV_MIL,
  BadgeIds.LAW_ENFORCEMENT,
] as const;

// Capability keys to check on-chain
const CAPABILITY_KEYS = Object.keys(CapabilityIds) as CapabilityKey[];

// User data interface
interface User {
  address: `0x${string}`;
  identityBadges: number[];
  capabilityBadges: CapabilityKey[];
}

function getBadgeName(badgeId: number): string {
  return BadgeIdNames[badgeId as keyof typeof BadgeIdNames] ?? `Badge ${badgeId}`;
}

function getBadgeVariant(badgeId: number): "default" | "secondary" | "outline" | "destructive" {
  if (badgeId === BadgeIds.GOV_MIL || badgeId === BadgeIds.LAW_ENFORCEMENT) {
    return "destructive";
  }
  if (badgeId === BadgeIds.MANUFACTURER || badgeId === BadgeIds.RETAILER) {
    return "default";
  }
  return "secondary";
}

const badgeFilters = [
  { value: BadgeIds.KYC_L1, label: "KYC L1", icon: Shield },
  { value: BadgeIds.KYC_L2, label: "KYC L2", icon: Shield },
  { value: BadgeIds.KYC_L3, label: "KYC L3", icon: Shield },
  { value: BadgeIds.MANUFACTURER, label: "Manufacturer", icon: Award },
  { value: BadgeIds.RETAILER, label: "Retailer", icon: Award },
  { value: BadgeIds.GOV_MIL, label: "Gov/Mil", icon: Shield },
  { value: BadgeIds.LAW_ENFORCEMENT, label: "Law Enforcement", icon: Shield },
];

const capabilityFilters = CAPABILITY_KEYS.map((key) => ({
  value: key,
  label: CapabilityIdNames[key],
}));

const columns: ColumnDef<User>[] = [
  {
    accessorKey: "address",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="p-0 hover:bg-transparent"
      >
        Address
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <Link
        href={`/users/${row.original.address}`}
        className="hover:text-primary transition-colors"
      >
        <AddressBadge address={row.original.address} showCopy={false} showEtherscan={false} />
      </Link>
    ),
  },
  {
    accessorKey: "identityBadges",
    header: "Identity Badges",
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        {row.original.identityBadges.length > 0 ? (
          row.original.identityBadges.map((badgeId) => (
            <Badge key={badgeId} variant={getBadgeVariant(badgeId)} className="text-xs">
              {getBadgeName(badgeId)}
            </Badge>
          ))
        ) : (
          <span className="text-muted-foreground text-sm">None</span>
        )}
      </div>
    ),
    filterFn: (row, _id, filterValue: number[]) => {
      if (!filterValue || filterValue.length === 0) return true;
      return filterValue.some((badge) => row.original.identityBadges.includes(badge));
    },
  },
  {
    accessorKey: "capabilityBadges",
    header: "Capabilities",
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        {row.original.capabilityBadges.length > 0 ? (
          row.original.capabilityBadges.map((key) => (
            <Badge key={key} variant="outline" className="text-xs">
              {CapabilityIdNames[key]}
            </Badge>
          ))
        ) : (
          <span className="text-muted-foreground text-sm">None</span>
        )}
      </div>
    ),
    filterFn: (row, _id, filterValue: CapabilityKey[]) => {
      if (!filterValue || filterValue.length === 0) return true;
      return filterValue.some((key) => row.original.capabilityBadges.includes(key));
    },
  },
];

export default function UsersPage() {
  const chainId = useChainId();
  const client = usePublicClient();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [badgeFilter, setBadgeFilter] = useState<number[]>([]);
  const [capFilter, setCapFilter] = useState<CapabilityKey[]>([]);

  const contracts = getContractsForChain(chainId);

  const fetchUsers = useCallback(async () => {
    if (!client) {
      setError("No RPC client available");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const results = await Promise.all(
        KNOWN_ADDRESSES.map(async (address) => {
          // Fetch identity badges held by this address
          const identityBadgesRaw = await client
            .readContract({
              address: contracts.IdentityBadge,
              abi: IdentityBadgeABI,
              functionName: "getBadges",
              args: [address],
            })
            .catch(() => [] as readonly bigint[]);

          const identityBadges = (identityBadgesRaw as readonly bigint[])
            .map(Number)
            .filter((id) => IDENTITY_BADGE_IDS.includes(id as (typeof IDENTITY_BADGE_IDS)[number]));

          // Fetch capability badge balances using balanceOfBatch
          const capAccounts = CAPABILITY_KEYS.map(() => address);
          const capIds = CAPABILITY_KEYS.map((key) => CapabilityIds[key]);

          const capBalances = await client
            .readContract({
              address: contracts.CapabilityBadge,
              abi: CapabilityBadgeABI,
              functionName: "balanceOfBatch",
              args: [capAccounts, capIds],
            })
            .catch(() => CAPABILITY_KEYS.map(() => 0n));

          const capabilityBadges = CAPABILITY_KEYS.filter(
            (_, i) => (capBalances as readonly bigint[])[i] > 0n,
          );

          return { address, identityBadges, capabilityBadges };
        }),
      );

      setUsers(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch badge holders");
    } finally {
      setLoading(false);
    }
  }, [client, contracts, chainId]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filteredData = users.filter((user) => {
    if (
      badgeFilter.length > 0 &&
      !badgeFilter.some((badge) => user.identityBadges.includes(badge))
    ) {
      return false;
    }
    if (capFilter.length > 0 && !capFilter.some((key) => user.capabilityBadges.includes(key))) {
      return false;
    }
    return true;
  });

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      globalFilter,
    },
  });

  const toggleBadgeFilter = (badge: number) => {
    setBadgeFilter((prev) =>
      prev.includes(badge) ? prev.filter((b) => b !== badge) : [...prev, badge],
    );
  };

  const toggleCapFilter = (key: CapabilityKey) => {
    setCapFilter((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const exportCSV = () => {
    const rows = table.getFilteredRowModel().rows;
    const headers = ["Address", "Identity Badges", "Capabilities"];
    const data = rows.map((row) => [
      row.original.address,
      row.original.identityBadges.map((b) => getBadgeName(b)).join("; "),
      row.original.capabilityBadges.map((k) => CapabilityIdNames[k]).join("; "),
    ]);

    const csv = [headers, ...data].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-muted-foreground">
            On-chain badge holders — live data from IdentityBadge + CapabilityBadge contracts
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="font-mono">
            {users.length} holders
          </Badge>
          <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Filters + Table */}
      {!loading && (
        <>
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {/* Search and Export Row */}
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by address..."
                      value={globalFilter}
                      onChange={(e) => setGlobalFilter(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Button variant="outline" onClick={exportCSV}>
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>

                {/* Badge Filters */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Shield className="h-4 w-4" />
                    Badges:
                  </div>
                  {badgeFilters.map((filter) => (
                    <Badge
                      key={filter.value}
                      variant={badgeFilter.includes(filter.value) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleBadgeFilter(filter.value)}
                    >
                      {filter.label}
                    </Badge>
                  ))}
                  {badgeFilter.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setBadgeFilter([])}
                      className="text-xs"
                    >
                      Clear
                    </Button>
                  )}
                </div>

                {/* Capability Filters */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Filter className="h-4 w-4" />
                    Capabilities:
                  </div>
                  {capabilityFilters.map((filter) => (
                    <Badge
                      key={filter.value}
                      variant={capFilter.includes(filter.value) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleCapFilter(filter.value)}
                    >
                      {filter.label}
                    </Badge>
                  ))}
                  {capFilter.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCapFilter([])}
                      className="text-xs"
                    >
                      Clear
                    </Button>
                  )}
                </div>
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
                    {table.getRowModel().rows.length ? (
                      table.getRowModel().rows.map((row) => (
                        <tr key={row.id} className="border-b hover:bg-muted/50 transition-colors">
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
                          No users match the current filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  {table.getRowModel().rows.length} of {filteredData.length} holders
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
                    {Math.max(1, table.getPageCount())}
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
        </>
      )}
    </div>
  );
}
