"use client";

/**
 * Items tab (WB-05) — items rendered from this template, plus the explicit
 * Propagate action (T24 job).
 *
 * DEFAULT VIEW: enumerates the services template-items endpoint
 * (GET /api/v1/admin/templates/:id/items via the items proxy — same row
 * shape + keyset pagination as the org-wide admin catalog list, tenant-
 * scoped through the template). Rows carry REAL per-item template linkage
 * (adopted templateVersion), so the drift banner is computed from the
 * ENUMERATED ROWS: exactly the items still rendering a snapshot older than
 * the latest published version. The manual token-id input is kept as a
 * client-side FILTER over the enumerated rows (ranges allowed, e.g.
 * "100-120, 150").
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
} from "@tagit/ui";
import { AlertTriangle, Download, ExternalLink, Loader2, Send } from "lucide-react";

import { PropagateModal } from "@/components/catalog/propagate-modal";
import {
  itemsBehindLatest,
  parseTokenIdInput,
  readTemplateItemsPage,
  type PublishState,
} from "@/lib/catalog/template-logic";
import { buildItemsCsv } from "@/lib/catalog/template-csv";
import type { TemplateDto, TemplateItemRow } from "@/lib/catalog/template-types";

const VERIFY_URL = process.env.NEXT_PUBLIC_VERIFY_URL || "https://verify.tagit.network";
const PAGE_LIMIT = 100; // services per-page cap

interface ItemsTabProps {
  template: TemplateDto;
  publishState: PublishState;
  writable: boolean;
}

export function ItemsTab({ template, publishState, writable }: ItemsTabProps) {
  const [rows, setRows] = useState<TemplateItemRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterInput, setFilterInput] = useState("");
  const [propagateOpen, setPropagateOpen] = useState(false);

  const loadPage = useCallback(
    async (cursor: string | null) => {
      setLoading(true);
      setLoadError(null);
      try {
        const qs = new URLSearchParams({ limit: String(PAGE_LIMIT) });
        if (cursor !== null) qs.set("cursor", cursor);
        const res = await fetch(
          `/api/catalog-proxy/templates/${template.id}/items?${qs.toString()}`,
          { cache: "no-store" },
        );
        const data: unknown = await res.json();
        const page = res.ok ? readTemplateItemsPage(data) : null;
        if (page === null) {
          const err = data as { error?: string; message?: string } | null;
          throw new Error(err?.error ?? err?.message ?? `items enumeration failed (${res.status})`);
        }
        setRows((prev) => (cursor === null ? page.rows : [...prev, ...page.rows]));
        setNextCursor(page.nextCursor);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Items enumeration failed");
      } finally {
        setLoading(false);
      }
    },
    [template.id],
  );

  // Default view: enumerate the first page on mount.
  useEffect(() => {
    void loadPage(null);
  }, [loadPage]);

  // Manual token-id input — a FILTER over the enumerated rows.
  const { filterIds, parseErrors } = useMemo(() => {
    if (filterInput.trim() === "") {
      return { filterIds: null as Set<string> | null, parseErrors: [] as string[] };
    }
    const { ids, errors } = parseTokenIdInput(filterInput);
    return { filterIds: new Set(ids), parseErrors: errors };
  }, [filterInput]);

  const visible = useMemo(
    () => (filterIds === null ? rows : rows.filter((r) => filterIds.has(r.tokenId))),
    [rows, filterIds],
  );

  // WB-05: drift banner from the ENUMERATED rows — items still rendering an
  // older snapshot than the latest published version.
  const behind = useMemo(
    () => itemsBehindLatest(rows, publishState.latestVersion),
    [rows, publishState.latestVersion],
  );

  const loadedIds = visible.map((r) => r.tokenId);

  const exportCsv = () => {
    if (visible.length === 0) return;
    const csv = buildItemsCsv(visible, VERIFY_URL);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${template.slug}-items.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Drift banner — computed from the enumerated rows (WB-05) */}
      {behind.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-yellow-500" />
          <div className="space-y-2">
            <p>
              {behind.length} of {rows.length} enumerated item{rows.length === 1 ? "" : "s"} still
              render{behind.length === 1 ? "s" : ""} a snapshot older than v
              {publishState.latestVersion}. Publish never re-renders items implicitly — propagate
              to move them onto the latest snapshot.
            </p>
            {writable && (
              <Button size="sm" onClick={() => setPropagateOpen(true)}>
                <Send className="h-3 w-3 mr-2" />
                Propagate to v{publishState.latestVersion}
              </Button>
            )}
          </div>
        </div>
      )}
      {behind.length === 0 && publishState.latestVersion > 0 && !loading && !loadError && (
        <p className="text-xs text-muted-foreground">
          {rows.length === 0
            ? `Snapshot v${publishState.latestVersion} is published; no items enumerate from this template yet.`
            : `All ${rows.length} enumerated item${rows.length === 1 ? "" : "s"} are on the latest snapshot (v${publishState.latestVersion}).`}
        </p>
      )}
      {publishState.latestVersion === 0 && (
        <p className="text-xs text-muted-foreground">
          Not published yet — items can only be adopted onto a published snapshot.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Items</CardTitle>
          <CardDescription>
            Enumerated from the services template-items endpoint (tenant-scoped through this
            template, {PAGE_LIMIT} per page). Use the token-id box to filter the enumerated rows
            (ranges allowed, e.g. “100-120, 150”).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>Filter by token ids</Label>
            <textarea
              value={filterInput}
              onChange={(e) => setFilterInput(e.target.value)}
              rows={2}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono shadow-sm placeholder:text-muted-foreground"
              placeholder="e.g., 1-25, 42, 107 — empty shows every enumerated item"
            />
            {parseErrors.map((e, i) => (
              <p key={i} className="text-xs text-destructive">
                {e}
              </p>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={exportCsv}
              disabled={visible.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            {writable && publishState.latestVersion > 0 && (
              <Button variant="outline" onClick={() => setPropagateOpen(true)}>
                <Send className="h-4 w-4 mr-2" />
                Propagate…
              </Button>
            )}
          </div>
          {loadError && <p className="text-xs text-destructive">{loadError}</p>}

          {visible.length > 0 && (
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Token</th>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Serial</th>
                    <th className="px-3 py-2 font-medium">Lifecycle</th>
                    <th className="px-3 py-2 font-medium">Snapshot</th>
                    <th className="px-3 py-2 font-medium">Anchor</th>
                    <th className="px-3 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => (
                    <ItemRow
                      key={row.tokenId}
                      row={row}
                      latestVersion={publishState.latestVersion}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading && visible.length === 0 && !loadError && (
            <p className="text-xs text-muted-foreground">
              {rows.length === 0
                ? "No items enumerate from this template yet."
                : "No enumerated items match the token-id filter."}
            </p>
          )}

          <div className="flex items-center gap-3">
            {loading && (
              <span className="flex items-center text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                Loading items…
              </span>
            )}
            {!loading && nextCursor !== null && (
              <Button variant="outline" size="sm" onClick={() => void loadPage(nextCursor)}>
                Load more
              </Button>
            )}
            {!loading && rows.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {rows.length} item{rows.length === 1 ? "" : "s"} enumerated
                {nextCursor !== null ? " so far" : ""}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <PropagateModal
        open={propagateOpen}
        onOpenChange={setPropagateOpen}
        template={template}
        targetVersion={publishState.latestVersion}
        loadedTokenIds={loadedIds}
      />
    </div>
  );
}

function ItemRow({ row, latestVersion }: { row: TemplateItemRow; latestVersion: number }) {
  const anchor =
    row.anchoredVersion !== null || row.latestVersion !== null
      ? `${row.anchoredVersion ?? "—"}/${row.latestVersion ?? "—"}${
          row.anchorStatus ? ` (${row.anchorStatus})` : ""
        }`
      : (row.anchorStatus ?? "—");
  const anchorBehind =
    row.drift ||
    (row.anchoredVersion !== null &&
      row.latestVersion !== null &&
      row.latestVersion > row.anchoredVersion);
  const snapshotBehind =
    row.templateVersion !== null && latestVersion > 0 && row.templateVersion < latestVersion;
  return (
    <tr className="border-b last:border-0">
      <td className="px-3 py-1.5 font-mono">#{row.tokenId}</td>
      <td className="px-3 py-1.5">
        {row.name ?? (
          <span className="text-muted-foreground">
            {row.needsProductInfo ? "needs product info" : "—"}
          </span>
        )}
        {row.restricted && (
          <span className="ml-1 text-xs text-muted-foreground" title="visibility: restricted">
            (restricted)
          </span>
        )}
      </td>
      <td className="px-3 py-1.5 font-mono text-xs">{row.serial ?? "—"}</td>
      <td className="px-3 py-1.5 text-xs">{row.lifecycle ?? "—"}</td>
      <td
        className={snapshotBehind ? "px-3 py-1.5 text-xs text-yellow-500" : "px-3 py-1.5 text-xs"}
        title={
          snapshotBehind
            ? `renders v${row.templateVersion} — latest published is v${latestVersion}`
            : undefined
        }
      >
        {row.templateVersion !== null ? `v${row.templateVersion}` : "—"}
        {snapshotBehind && " ⚠"}
      </td>
      <td className={anchorBehind ? "px-3 py-1.5 text-xs text-yellow-500" : "px-3 py-1.5 text-xs"}>
        {anchor}
      </td>
      <td className="px-3 py-1.5">
        <a
          href={`${VERIFY_URL}/asset/${row.tokenId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
        >
          verify
          <ExternalLink className="h-3 w-3 ml-1" />
        </a>
      </td>
    </tr>
  );
}
