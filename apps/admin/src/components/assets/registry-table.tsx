"use client";

import { useMemo, useState } from "react";
import { Badge, Card, CardContent, Input } from "@tagit/ui";
import { Search, ShieldOff } from "lucide-react";
import type { RegistryRow } from "@/lib/catalog/types";
import { AnchorDot } from "./anchor-dot";
import { AssetSlideOver } from "./asset-slide-over";

/**
 * Org-wide catalog registry table (META-T36; WB-04). Rows come
 * server-rendered from the services ADMIN catalog list, so the template and
 * serial columns carry REAL values and restricted/unanchored items are
 * present (marked, not hidden). Clicking a row opens the detail slide-over.
 */

const LIFECYCLE_CLASSES: Record<string, string> = {
  draft: "bg-secondary text-secondary-foreground",
  minted: "bg-blue-500/10 text-blue-500",
  bound: "bg-indigo-500/10 text-indigo-500",
  anchored: "bg-green-500/10 text-green-500",
  recycled: "bg-muted text-muted-foreground line-through",
};

export function RegistryTable({ rows }: { rows: RegistryRow[] }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.tokenId.includes(q) ||
        (r.name ?? "").toLowerCase().includes(q) ||
        (r.serial ?? "").toLowerCase().includes(q) ||
        (r.templateId ?? "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  return (
    <>
      <Card>
        <CardContent className="pt-6">
          <div className="relative mb-4 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Quick search by Token ID, name, serial or template…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-sm font-medium text-muted-foreground">
                  <th className="px-4 py-3">Item</th>
                  <th className="hidden px-4 py-3 lg:table-cell">Template</th>
                  <th className="hidden px-4 py-3 lg:table-cell">Serial</th>
                  <th className="px-4 py-3">Lifecycle</th>
                  <th className="hidden px-4 py-3 md:table-cell">Bound</th>
                  <th className="hidden px-4 py-3 md:table-cell">Price</th>
                  <th className="px-4 py-3">Anchor</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      {rows.length === 0
                        ? "No catalog items on this page match the current filters."
                        : "No items match your search."}
                    </td>
                  </tr>
                ) : (
                  visible.map((row) => (
                    <tr
                      key={row.tokenId}
                      onClick={() => setSelected(row.tokenId)}
                      className="cursor-pointer border-b transition-colors hover:bg-muted/50"
                    >
                      <td className="px-4 py-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 truncate font-medium">
                            {row.name ?? (
                              <span className="text-yellow-500">Needs product info</span>
                            )}
                            {row.restricted && (
                              <span
                                className="flex items-center gap-1 text-xs text-muted-foreground"
                                title="visibility: restricted — the public DTO serves a protected stub"
                              >
                                <ShieldOff className="h-3.5 w-3.5" />
                                restricted
                              </span>
                            )}
                          </div>
                          <div className="font-mono text-xs text-muted-foreground">
                            #{row.tokenId}
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 text-sm lg:table-cell">
                        {row.templateId ? (
                          <span className="font-mono text-xs">
                            {row.templateId}
                            {row.templateVersion !== null && (
                              <span className="text-muted-foreground"> v{row.templateVersion}</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 font-mono text-xs lg:table-cell">
                        {row.serial ?? <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {row.lifecycle ? (
                          <Badge
                            variant="secondary"
                            className={LIFECYCLE_CLASSES[row.lifecycle] ?? ""}
                          >
                            {row.lifecycle}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        {row.bound ? (
                          <Badge variant="secondary" className="bg-blue-500/10 text-blue-500">
                            Bound
                          </Badge>
                        ) : (
                          <Badge variant="outline">Unbound</Badge>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 text-sm md:table-cell">
                        {row.priceDisplay ?? (
                          <span className="text-muted-foreground">
                            {row.saleState === "sold" ? "Sold" : "—"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <AnchorDot verdict={row.verdict} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-sm text-muted-foreground">
            Showing {visible.length} of {rows.length} items on this page
          </p>
        </CardContent>
      </Card>

      {selected && <AssetSlideOver tokenId={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
