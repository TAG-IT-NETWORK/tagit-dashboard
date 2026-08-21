"use client";

/**
 * Items tab — items rendered from this template, plus the explicit
 * Propagate action (T24 job).
 *
 * DATA LIMITATION (deliberate — mirrors lib/server/templates-upstream.ts):
 * tagit-services main ships no template→items enumeration endpoint and the
 * public per-token DTO carries no template linkage, so rows are resolved
 * from an EXPLICIT token-id set (ids or ranges — the same explicit-tokenIds
 * model the adopt/propagate endpoints use). The drift banner is therefore
 * template-level (a republish leaves previously-adopted items on an older
 * snapshot by definition); per-row anchor state is the metadata-level
 * signal.
 */

import { useState } from "react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
} from "@tagit/ui";
import { AlertTriangle, Download, ExternalLink, ImageIcon, Loader2, Send } from "lucide-react";

import { PropagateModal } from "@/components/catalog/propagate-modal";
import { parseTokenIdInput, type PublishState } from "@/lib/catalog/template-logic";
import { buildItemsCsv } from "@/lib/catalog/template-csv";
import type { TemplateDto, TemplateItemRow } from "@/lib/catalog/template-types";

const VERIFY_URL = process.env.NEXT_PUBLIC_VERIFY_URL || "https://verify.tagit.network";
const CHUNK = 100; // items proxy per-request cap

interface ItemsTabProps {
  template: TemplateDto;
  publishState: PublishState;
  writable: boolean;
}

export function ItemsTab({ template, publishState, writable }: ItemsTabProps) {
  const [input, setInput] = useState("");
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [rows, setRows] = useState<TemplateItemRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [propagateOpen, setPropagateOpen] = useState(false);

  const loadedIds = rows?.map((r) => r.tokenId) ?? [];

  const load = async () => {
    const { ids, errors } = parseTokenIdInput(input);
    setParseErrors(errors);
    if (ids.length === 0) {
      setRows(null);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const all: TemplateItemRow[] = [];
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        const res = await fetch(
          `/api/catalog-proxy/templates/${template.id}/items?tokenIds=${chunk.join(",")}`,
          { cache: "no-store" },
        );
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error || `items lookup failed (${res.status})`);
        }
        all.push(...(data.rows as TemplateItemRow[]));
      }
      setRows(all);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Items lookup failed");
      setRows(null);
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = () => {
    if (!rows || rows.length === 0) return;
    const csv = buildItemsCsv(rows, VERIFY_URL);
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
      {/* Drift banner */}
      {publishState.itemsDrift === "behind" && (
        <div className="flex items-start gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-yellow-500" />
          <div className="space-y-2">
            <p>
              This template has been republished (latest snapshot v{publishState.latestVersion}).
              Items adopted before that publish keep rendering their older snapshot until you
              propagate — publish never re-renders items implicitly.
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
      {publishState.itemsDrift === "info" && (
        <p className="text-xs text-muted-foreground">
          Snapshot v1 is published. After any future republish, adopted items stay on their old
          snapshot until an explicit propagate.
        </p>
      )}
      {publishState.itemsDrift === "none" && (
        <p className="text-xs text-muted-foreground">
          Not published yet — items can only be adopted onto a published snapshot.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Items</CardTitle>
          <CardDescription>
            tagit-services has no template→items listing endpoint yet, so enter the token ids to
            inspect (ranges allowed, e.g. “100-120, 150”) — the same explicit-token-id model the
            propagate API uses. Rows come from the per-token catalog DTO via the server proxy.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>Token ids</Label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={2}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono shadow-sm placeholder:text-muted-foreground"
              placeholder="e.g., 1-25, 42, 107"
            />
            {parseErrors.map((e, i) => (
              <p key={i} className="text-xs text-destructive">
                {e}
              </p>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={load} disabled={loading || input.trim() === ""}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading…
                </>
              ) : (
                "Load items"
              )}
            </Button>
            <Button
              variant="outline"
              onClick={exportCsv}
              disabled={!rows || rows.length === 0}
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

          {rows && rows.length > 0 && (
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 font-medium w-12"></th>
                    <th className="px-3 py-2 font-medium">Token</th>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">SKU</th>
                    <th className="px-3 py-2 font-medium">Lifecycle</th>
                    <th className="px-3 py-2 font-medium">Anchor</th>
                    <th className="px-3 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <ItemRow key={row.tokenId} row={row} templateSku={template.sku} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {rows && rows.length === 0 && (
            <p className="text-xs text-muted-foreground">No rows resolved.</p>
          )}
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

function ItemRow({ row, templateSku }: { row: TemplateItemRow; templateSku: string | null }) {
  const anchor =
    row.anchoredVersion !== null || row.latestVersion !== null
      ? `${row.anchoredVersion ?? "—"}/${row.latestVersion ?? "—"}${
          row.anchorStatus ? ` (${row.anchorStatus})` : ""
        }`
      : (row.anchorStatus ?? "—");
  const behind =
    row.anchoredVersion !== null &&
    row.latestVersion !== null &&
    row.latestVersion > row.anchoredVersion;
  const skuMatch = templateSku !== null && row.sku !== null && row.sku === templateSku;
  return (
    <tr className="border-b last:border-0">
      <td className="px-3 py-1.5">
        {row.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote media host thumb
          <img src={row.image} alt="" className="h-8 w-8 rounded object-cover border" loading="lazy" />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded border bg-muted text-muted-foreground">
            <ImageIcon className="h-3 w-3" />
          </span>
        )}
      </td>
      <td className="px-3 py-1.5 font-mono">#{row.tokenId}</td>
      <td className="px-3 py-1.5">
        {row.restricted ? (
          <span className="text-muted-foreground">restricted</span>
        ) : row.found ? (
          (row.name ?? <span className="text-muted-foreground">—</span>)
        ) : (
          <span className="text-muted-foreground">not found</span>
        )}
      </td>
      <td className="px-3 py-1.5 font-mono text-xs">
        {row.sku ?? "—"}
        {row.sku !== null && templateSku !== null && (
          <span
            className={skuMatch ? "ml-1 text-green-500" : "ml-1 text-yellow-500"}
            title={skuMatch ? "matches template SKU" : "differs from template SKU"}
          >
            {skuMatch ? "•" : "≠"}
          </span>
        )}
      </td>
      <td className="px-3 py-1.5 text-xs">{row.lifecycleState ?? "—"}</td>
      <td className={behind ? "px-3 py-1.5 text-xs text-yellow-500" : "px-3 py-1.5 text-xs"}>
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
