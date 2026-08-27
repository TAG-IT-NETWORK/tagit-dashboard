import Link from "next/link";
import { Badge, Button, Card, CardContent } from "@tagit/ui";
import { ChevronRight, Filter, Plus } from "lucide-react";
import {
  applyRegistryFilters,
  parseRegistryFilters,
  registryHref,
} from "@/lib/catalog/logic";
import type { RegistryFilters } from "@/lib/catalog/types";
import { CATALOG_LIFECYCLES } from "@/lib/catalog/types";
import { fetchRegistry, REGISTRY_PAGE_LIMIT } from "@/lib/catalog/server";
import { RegistryTable } from "@/components/assets/registry-table";

/**
 * /assets — org-wide item registry from the services ADMIN catalog list
 * (META-T36; WB-04: GET /api/v1/admin/catalog).
 *
 * Server-rendered: the page is assembled server-side (the admin API key
 * stays on the server) and filters + the keyset cursor live in the URL
 * search params, so filtered views and deep pages are shareable links.
 * Restricted, unanchored and drifted items appear (the old public fan-out
 * only saw public+confirmed rows); template + serial columns carry real
 * values. Filters run server-side (lifecycle/drift/needsProductInfo query
 * params) with a client-side re-filter as defense in depth.
 */

export const dynamic = "force-dynamic";

const LIFECYCLE_LABELS: Record<string, string> = {
  draft: "Draft",
  minted: "Minted",
  bound: "Bound",
  anchored: "Anchored",
  recycled: "Recycled",
};

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
  const rawCursor = searchParams?.cursor;
  const cursor =
    typeof rawCursor === "string" && /^\d+$/.test(rawCursor) ? rawCursor : undefined;

  const registry = await fetchRegistry(filters, cursor);
  const rows = applyRegistryFilters(registry.rows, filters);

  const toggle = (patch: Partial<RegistryFilters>): string =>
    registryHref({ ...filters, ...patch });
  const anyFilter = filters.lifecycle !== null || filters.needsInfo || filters.drift;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Assets</h1>
          <p className="text-muted-foreground">
            {registry.error
              ? "Catalog unavailable"
              : `Org-wide item registry — ${REGISTRY_PAGE_LIMIT} per page, including restricted and unanchored items`}
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

      {/* Filters — URL search params, server-rendered */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            {CATALOG_LIFECYCLES.map((lifecycle) => (
              <FilterChip
                key={lifecycle}
                active={filters.lifecycle === lifecycle}
                href={toggle({
                  lifecycle: filters.lifecycle === lifecycle ? null : lifecycle,
                })}
              >
                {LIFECYCLE_LABELS[lifecycle] ?? lifecycle}
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
            {anyFilter && (
              <Button variant="ghost" size="sm" asChild className="text-xs">
                <Link href="/assets">Clear</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Registry table + slide-over */}
      <RegistryTable rows={rows} />

      {/* Keyset pagination — the cursor is the last SCANNED token id, so a
          filtered page can be sparse while more matches remain. */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {cursor
            ? `Page after token #${cursor}`
            : "First page"}
          {" · "}
          {rows.length} item{rows.length === 1 ? "" : "s"} shown
        </span>
        <div className="flex gap-2">
          {cursor && (
            <Button variant="ghost" size="sm" asChild>
              <Link href={registryHref(filters)}>First page</Link>
            </Button>
          )}
          {registry.nextCursor && (
            <Button variant="outline" size="sm" asChild>
              <Link href={registryHref(filters, registry.nextCursor)}>
                Next page
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
