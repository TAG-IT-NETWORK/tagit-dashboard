"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, Badge, StateBadge, AddressBadge, ConnectButton } from "@tagit/ui";
import { useAllAssets, type Asset } from "@tagit/contracts";
import { WagmiGuard } from "@/components/wagmi-guard";

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
  const [stateFilter, setStateFilter] = useState<number[]>([]);

  const {
    assets,
    totalSupply,
    totalPages,
    hasNextPage,
    hasPrevPage,
    isLoading,
    error,
    refetch,
  } = useAllAssets({ page, pageSize, refetchInterval: 30000 });

  const filteredAssets = useMemo(() => {
    if (stateFilter.length === 0) return assets;
    return assets.filter((asset) => stateFilter.includes(asset.state));
  }, [assets, stateFilter]);

  const toggleStateFilter = (state: number) => {
    setStateFilter((prev) =>
      prev.includes(state) ? prev.filter((s) => s !== state) : [...prev, state]
    );
  };

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">TAG IT Console</h1>
            <p className="text-muted-foreground">B2B Portal</p>
          </div>
          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-2 text-sm">
              <Link href="/" className="px-3 py-2 rounded-md hover:bg-muted transition-colors">
                Dashboard
              </Link>
              <Link href="/assets" className="px-3 py-2 rounded-md bg-primary/10 text-primary font-medium">
                Assets
              </Link>
              <Link href="/badges" className="px-3 py-2 rounded-md hover:bg-muted transition-colors">
                Badges
              </Link>
            </nav>
            <ConnectButton />
          </div>
        </header>

        <div className="space-y-6">
          {/* Page header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Assets</h2>
              <p className="text-muted-foreground">
                {isLoading ? "Loading assets..." : `Total: ${totalSupply.toLocaleString()} assets on the network`}
              </p>
            </div>
            <button
              onClick={() => refetch()}
              disabled={isLoading}
              className="px-3 py-2 text-sm border rounded-md hover:bg-muted transition-colors disabled:opacity-50"
            >
              {isLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {/* Error */}
          {error && (
            <Card className="border-destructive">
              <CardContent className="pt-6">
                <p className="text-destructive text-sm">Error loading assets: {error.message}</p>
              </CardContent>
            </Card>
          )}

          {/* State filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Filter:</span>
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
              <button
                onClick={() => setStateFilter([])}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>

          {/* Table */}
          <Card>
            <CardContent className="pt-6">
              <div className="rounded-md border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Token ID</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">State</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Owner</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      Array.from({ length: 10 }).map((_, i) => (
                        <tr key={i} className="border-b">
                          <td className="px-4 py-3"><div className="h-5 w-16 animate-pulse bg-muted rounded" /></td>
                          <td className="px-4 py-3"><div className="h-5 w-20 animate-pulse bg-muted rounded" /></td>
                          <td className="px-4 py-3"><div className="h-5 w-32 animate-pulse bg-muted rounded" /></td>
                          <td className="px-4 py-3"><div className="h-5 w-16 animate-pulse bg-muted rounded" /></td>
                        </tr>
                      ))
                    ) : filteredAssets.length > 0 ? (
                      filteredAssets.map((asset) => (
                        <tr key={asset.tokenId.toString()} className="border-b hover:bg-muted/50 transition-colors">
                          <td className="px-4 py-3 font-mono font-medium">#{asset.tokenId.toString()}</td>
                          <td className="px-4 py-3"><StateBadge state={asset.state} /></td>
                          <td className="px-4 py-3"><AddressBadge address={asset.owner} /></td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {formatRelativeTime(Number(asset.timestamp) * 1000)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
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
                  {!isLoading && (
                    <>
                      Showing {filteredAssets.length} of {totalSupply} assets
                      {stateFilter.length > 0 && " (filtered)"}
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(0)}
                    disabled={!hasPrevPage || isLoading}
                    className="px-2 py-1 text-sm border rounded hover:bg-muted disabled:opacity-50"
                  >
                    First
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={!hasPrevPage || isLoading}
                    className="px-2 py-1 text-sm border rounded hover:bg-muted disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <span className="text-sm">
                    Page {page + 1} of {Math.max(1, totalPages)}
                  </span>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!hasNextPage || isLoading}
                    className="px-2 py-1 text-sm border rounded hover:bg-muted disabled:opacity-50"
                  >
                    Next
                  </button>
                  <button
                    onClick={() => setPage(Math.max(0, totalPages - 1))}
                    disabled={!hasNextPage || isLoading}
                    className="px-2 py-1 text-sm border rounded hover:bg-muted disabled:opacity-50"
                  >
                    Last
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
