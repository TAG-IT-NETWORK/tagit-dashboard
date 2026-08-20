import Link from "next/link";
import { Badge, Button, Card, CardContent } from "@tagit/ui";
import { AlertTriangle, Filter, Plus } from "lucide-react";
import {
  applyRegistryFilters,
  parseRegistryFilters,
  registryHref,
} from "@/lib/catalog/logic";
import type { RegistryFilters } from "@/lib/catalog/types";
import { fetchRegistry, MAX_REGISTRY_SCAN } from "@/lib/catalog/server";
import { RegistryTable } from "@/components/assets/registry-table";

/**
 * /assets — org-wide item registry from the services catalog (META-T36).
 *
 * Server-rendered: the registry is assembled server-side (the admin API key
 * stays on the server) and filters live in the URL search params, so filtered
 * views are shareable links. Replaces the old contract-scan table and its
 * "Requires indexer" placeholder columns — thumbnails, product names, price
 * and the anchor verdict now come from the catalog, not from per-page chain
 * enumeration.
 */

export const dynamic = "force-dynamic";

const STATE_CHIPS: Array<{ code: number; label: string }> = [
  { code: 1, label: "Minted" },
  { code: 2, label: "Bound" },
  { code: 3, label: "Activated" },
  { code: 4, label: "Claimed" },
  { code: 5, label: "Flagged" },
  { code: 6, label: "Recycled" },
];

function FilterChip({
  active,
  href,
  children,
}: {
  active: boolean;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href}>
      <Badge variant={active ? "default" : "outline"} className="cursor-pointer">
        {children}
      </Badge>
    </Link>
  );
}

export default async function AssetsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const filters = parseRegistryFilters(searchParams ?? {});
  const registry = await fetchRegistry();
  const rows = applyRegistryFilters(registry.rows, filters);

  const toggle = (patch: Partial<RegistryFilters>): string =>
    registryHref({ ...filters, ...patch });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Assets</h1>
          <p className="text-muted-foreground">
            {registry.error
              ? "Catalog unavailable"
              : `${registry.total.toLocaleString()} item${registry.total === 1 ? "" : "s"} in the services catalog`}
          </p>
        </div>
        <Button asChild>
          <Link href="/assets/new">
            <Plus className="mr-2 h-4 w-4" />
            Mint Asset
          </Link>
        </Button>
      </div>

      {/* Catalog fetch error */}
      {registry.error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{registry.error}</p>
          </CardContent>
        </Card>
      )}

      {/* Truncation notice */}
      {registry.truncated && (
        <div className="flex items-center gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-500">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Showing the first {MAX_REGISTRY_SCAN} of {registry.total} items — the services API has
          no paginated admin list endpoint yet.
        </div>
      )}

      {/* Filters — URL search params, server-rendered */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            {STATE_CHIPS.map((chip) => (
              <FilterChip
                key={chip.code}
                active={filters.state === chip.code}
                href={toggle({ state: filters.state === chip.code ? null : chip.code })}
              >
                {chip.label}
              </FilterChip>
            ))}
            <span className="mx-1 h-4 w-px bg-border" aria-hidden />
            <FilterChip
              active={filters.needsInfo}
              href={toggle({ needsInfo: !filters.needsInfo })}
            >
              Needs product info
            </FilterChip>
            <FilterChip active={filters.drift} href={toggle({ drift: !filters.drift })}>
              Drift
            </FilterChip>
            {(filters.state !== null || filters.needsInfo || filters.drift) && (
              <Button variant="ghost" size="sm" asChild className="text-xs">
                <Link href="/assets">Clear</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Registry table + slide-over */}
      <RegistryTable rows={rows} />
    </div>
  );
}
