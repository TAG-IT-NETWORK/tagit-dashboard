"use client";

import { useMemo, useState } from "react";
import { Badge, Card, CardContent, Input, StateBadge } from "@tagit/ui";
import { ImageIcon, Search, ShieldOff } from "lucide-react";
import type { RegistryRow } from "@/lib/catalog/types";
import { AnchorDot } from "./anchor-dot";
import { AssetSlideOver } from "./asset-slide-over";

/**
 * Org-wide catalog registry table (META-T36). Rows come server-rendered from
 * the services catalog; clicking a row opens the detail slide-over.
 *
 * Template + serial columns: the services public DTO does not expose the
 * catalog row's template_id / tagit.serial — they render as "—" until an
 * admin catalog list endpoint ships (see page limitation note).
 */
export function RegistryTable({ rows }: { rows: RegistryRow[] }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.tokenId.includes(q) || (r.name ?? "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  return (
    <>
      <Card>
        <CardContent className="pt-6">
          <div className="relative mb-4 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Quick search by Token ID or name…"
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
                  <th
                    className="hidden px-4 py-3 lg:table-cell"
                    title="Not exposed by the services public DTO yet"
                  >
                    Template
                  </th>
                  <th
                    className="hidden px-4 py-3 lg:table-cell"
                    title="Not exposed by the services public DTO yet"
                  >
                    Serial
                  </th>
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
                        ? "No catalog items match the current filters."
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
                        <div className="flex items-center gap-3">
                          {row.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={row.image}
                              alt=""
                              className="h-10 w-10 rounded-md border border-border object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">
                              {row.restricted ? (
                                <ShieldOff className="h-4 w-4" />
                              ) : (
                                <ImageIcon className="h-4 w-4" />
                              )}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="truncate font-medium">
                              {row.restricted ? (
                                <span className="text-muted-foreground">Restricted item</span>
                              ) : (
                                row.name ?? (
                                  <span className="text-yellow-500">Needs product info</span>
                                )
                              )}
                            </div>
                            <div className="font-mono text-xs text-muted-foreground">
                              #{row.tokenId}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 text-sm text-muted-foreground lg:table-cell">
                        —
                      </td>
                      <td className="hidden px-4 py-3 text-sm text-muted-foreground lg:table-cell">
                        —
                      </td>
                      <td className="px-4 py-3">
                        {row.stateCode !== null ? (
                          <StateBadge state={row.stateCode} />
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
            Showing {visible.length} of {rows.length} items
          </p>
        </CardContent>
      </Card>

      {selected && <AssetSlideOver tokenId={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
