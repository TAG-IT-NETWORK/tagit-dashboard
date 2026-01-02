"use client";

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
  Button,
  Input,
  Badge,
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
  Shield,
  Award,
} from "lucide-react";
import { BadgeIds, BadgeIdNames } from "@tagit/contracts";

// User data interface
interface User {
  address: string;
  identityBadges: number[];
  capabilityBadges: number[];
  assetsOwned: number;
  lastActivity: number;
}

// Mock data - in production, fetch from indexer/events
const mockUsers: User[] = Array.from({ length: 75 }, (_, i) => {
  const hasKyc = Math.random() > 0.3;
  const kycLevel = hasKyc ? Math.floor(Math.random() * 3) + 1 : 0;
  const identityBadges: number[] = [];
  if (kycLevel >= 1) identityBadges.push(BadgeIds.KYC_L1);
  if (kycLevel >= 2) identityBadges.push(BadgeIds.KYC_L2);
  if (kycLevel >= 3) identityBadges.push(BadgeIds.KYC_L3);
  if (Math.random() > 0.7) identityBadges.push(BadgeIds.MANUFACTURER);
  if (Math.random() > 0.8) identityBadges.push(BadgeIds.RETAILER);
  if (Math.random() > 0.95) identityBadges.push(BadgeIds.GOV_MIL);
  if (Math.random() > 0.95) identityBadges.push(BadgeIds.LAW_ENFORCEMENT);

  const capabilityBadges: number[] = [];
  if (Math.random() > 0.6) capabilityBadges.push(1); // MINTER
  if (Math.random() > 0.7) capabilityBadges.push(2); // BINDER
  if (Math.random() > 0.8) capabilityBadges.push(3); // ACTIVATOR
  if (Math.random() > 0.9) capabilityBadges.push(4); // FLAGGER
  if (Math.random() > 0.95) capabilityBadges.push(5); // RESOLVER

  return {
    address: `0x${(i + 1).toString(16).padStart(4, "0")}${Math.random().toString(16).slice(2, 38)}`,
    identityBadges,
    capabilityBadges,
    assetsOwned: Math.floor(Math.random() * 50),
    lastActivity: Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000,
  };
});

const capabilityNames: Record<number, string> = {
  1: "Minter",
  2: "Binder",
  3: "Activator",
  4: "Flagger",
  5: "Resolver",
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
        <AddressBadge
          address={row.original.address}
          showCopy={false}
          showEtherscan={false}
        />
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
    filterFn: (row, id, filterValue: number[]) => {
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
          row.original.capabilityBadges.map((capId) => (
            <Badge key={capId} variant="outline" className="text-xs">
              {capabilityNames[capId] ?? `Cap ${capId}`}
            </Badge>
          ))
        ) : (
          <span className="text-muted-foreground text-sm">None</span>
        )}
      </div>
    ),
    filterFn: (row, id, filterValue: number[]) => {
      if (!filterValue || filterValue.length === 0) return true;
      return filterValue.some((cap) => row.original.capabilityBadges.includes(cap));
    },
  },
  {
    accessorKey: "assetsOwned",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="p-0 hover:bg-transparent"
      >
        Assets Owned
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="font-medium">{row.original.assetsOwned}</span>
    ),
  },
  {
    accessorKey: "lastActivity",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="p-0 hover:bg-transparent"
      >
        Last Activity
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {formatRelativeTime(row.original.lastActivity)}
      </span>
    ),
  },
];

const badgeFilters = [
  { value: BadgeIds.KYC_L1, label: "KYC L1", icon: Shield },
  { value: BadgeIds.KYC_L2, label: "KYC L2", icon: Shield },
  { value: BadgeIds.KYC_L3, label: "KYC L3", icon: Shield },
  { value: BadgeIds.MANUFACTURER, label: "Manufacturer", icon: Award },
  { value: BadgeIds.RETAILER, label: "Retailer", icon: Award },
  { value: BadgeIds.GOV_MIL, label: "Gov/Mil", icon: Shield },
  { value: BadgeIds.LAW_ENFORCEMENT, label: "Law Enforcement", icon: Shield },
];

const capabilityFilters = [
  { value: 1, label: "Minter" },
  { value: 2, label: "Binder" },
  { value: 3, label: "Activator" },
  { value: 4, label: "Flagger" },
  { value: 5, label: "Resolver" },
];

export default function UsersPage() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [badgeFilter, setBadgeFilter] = useState<number[]>([]);
  const [capFilter, setCapFilter] = useState<number[]>([]);

  const filteredData = useMemo(() => {
    let data = mockUsers;
    if (badgeFilter.length > 0) {
      data = data.filter((user) =>
        badgeFilter.some((badge) => user.identityBadges.includes(badge))
      );
    }
    if (capFilter.length > 0) {
      data = data.filter((user) =>
        capFilter.some((cap) => user.capabilityBadges.includes(cap))
      );
    }
    return data;
  }, [badgeFilter, capFilter]);

  const table = useReactTable({
    data: filteredData,
    columns,
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
        pageSize: 25,
      },
    },
  });

  const toggleBadgeFilter = (badge: number) => {
    setBadgeFilter((prev) =>
      prev.includes(badge) ? prev.filter((b) => b !== badge) : [...prev, badge]
    );
  };

  const toggleCapFilter = (cap: number) => {
    setCapFilter((prev) =>
      prev.includes(cap) ? prev.filter((c) => c !== cap) : [...prev, cap]
    );
  };

  const exportCSV = () => {
    const rows = table.getFilteredRowModel().rows;
    const headers = ["Address", "Identity Badges", "Capabilities", "Assets Owned", "Last Activity"];
    const data = rows.map((row) => [
      row.original.address,
      row.original.identityBadges.map((b) => getBadgeName(b)).join("; "),
      row.original.capabilityBadges.map((c) => capabilityNames[c] ?? `Cap ${c}`).join("; "),
      row.original.assetsOwned,
      new Date(row.original.lastActivity).toISOString(),
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
            Manage users and their badges on the network
          </p>
        </div>
      </div>

      {/* Filters */}
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
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Showing {table.getRowModel().rows.length} of {filteredData.length} users
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
                Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
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
