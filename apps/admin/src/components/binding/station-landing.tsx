"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Loader2, Nfc, RefreshCw, Usb, Wifi, WifiOff, Zap } from "lucide-react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@tagit/ui";
import { useNfcBridge } from "@/lib/nfc-bridge";
import {
  batchWizardHref,
  parseBatchListRows,
  parseTemplateNames,
  sortForStation,
  stationHref,
  summarizeBatch,
  type BatchStationSummary,
} from "@/lib/binding/landing";

/** Batches whose per-token status we resolve (newest first) — bounded fan-out. */
const STATUS_FANOUT = 12;

export function StationLanding() {
  const bridge = useNfcBridge(true);
  const [batches, setBatches] = useState<BatchStationSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [templatesRes, batchesRes] = await Promise.all([
        fetch("/api/catalog-proxy/templates", { cache: "no-store" }),
        fetch("/api/catalog-proxy/batches?limit=50", { cache: "no-store" }),
      ]);
      const names = parseTemplateNames(await templatesRes.json().catch(() => null));
      const rows = batchesRes.ok ? parseBatchListRows(await batchesRes.json().catch(() => null)) : null;
      if (rows === null) {
        setError(`Could not load the batch list (${batchesRes.status || "network"})`);
        setBatches([]);
        return;
      }
      const head = rows.slice(0, STATUS_FANOUT);
      const summaries = await Promise.all(
        head.map(async (row) => {
          try {
            const res = await fetch(`/api/catalog-proxy/batches/${encodeURIComponent(row.id)}`, {
              cache: "no-store",
            });
            const body: unknown = res.ok ? await res.json().catch(() => null) : null;
            return summarizeBatch(row, body, row.templateId ? (names.get(row.templateId) ?? null) : null);
          } catch {
            return summarizeBatch(row, null, row.templateId ? (names.get(row.templateId) ?? null) : null);
          }
        }),
      );
      setBatches(sortForStation(summaries));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load batches");
      setBatches([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const open = (batches ?? []).filter((b) => b.unbound > 0);
  const done = (batches ?? []).filter((b) => b.unbound === 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Nfc className="h-6 w-6 text-emerald-500" /> Binding Station
          </h1>
          <p className="text-muted-foreground">
            Attach NFC chips to minted items. Pick a batch below — the station opens on its next
            unbound token.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* Hardware status — the same bridge the station uses */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 pt-6 text-sm">
          <span className={`flex items-center gap-2 ${bridge.wsConnected ? "text-green-500" : "text-yellow-500"}`}>
            {bridge.wsConnected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            {bridge.wsConnected ? "Bridge connected" : "Bridge not connected"}
          </span>
          <span className={`flex items-center gap-2 ${bridge.readerConnected ? "text-green-500" : "text-muted-foreground"}`}>
            <Usb className="h-4 w-4" />
            {bridge.readerConnected ? (bridge.readerName ?? "Reader connected") : "No reader detected"}
          </span>
          {bridge.card && (
            <span className="font-mono text-xs text-muted-foreground">
              chip on reader: {bridge.card.uid}
            </span>
          )}
          {!bridge.wsConnected && (
            <span className="text-xs text-muted-foreground">
              Start the desktop bridge on this Mac and paste its token in Assets → Bind NFC Tag →
              Desktop Reader once per browser.
            </span>
          )}
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Needs chips</h2>
        {loading && batches === null ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading batches…
          </div>
        ) : open.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              Every minted item has a chip. Create a new batch from a template in{" "}
              <Link href="/catalog" className="underline">
                Catalog
              </Link>{" "}
              to bind more.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {open.map((b) => (
              <BatchCard key={b.id} batch={b} primary />
            ))}
          </div>
        )}
      </section>

      {done.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-muted-foreground">Complete</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {done.map((b) => (
              <BatchCard key={b.id} batch={b} />
            ))}
          </div>
        </section>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How a bind works</CardTitle>
          <CardDescription>Three taps per chip, all on the station page.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>
              Place the chip on the reader. A blank chip from the roll shows{" "}
              <span className="text-foreground">Program SDM and retry</span> — click it once.
            </li>
            <li>The station verifies the chip&apos;s SUN signature with the server (amber = counter-only until the SDM key is provisioned).</li>
            <li>The relayer binds the tag on-chain and the metadata anchor follows automatically.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

function BatchCard({ batch, primary = false }: { batch: BatchStationSummary; primary?: boolean }) {
  const canOpen = batch.templateId !== null;
  return (
    <Card className={primary ? "border-emerald-500/40" : undefined}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{batch.templateName ?? "Untitled template"}</CardTitle>
            <CardDescription className="font-mono text-xs">{batch.id}</CardDescription>
          </div>
          <Badge variant={batch.unbound > 0 ? "default" : "secondary"}>
            {batch.unknown ? "status unknown" : batch.unbound > 0 ? `${batch.unbound} to bind` : "complete"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-muted-foreground">
          {batch.unknown ? (
            <>size {batch.size} · state {batch.state}</>
          ) : (
            <>
              {batch.bound}/{batch.total} bound
              {batch.recycled > 0 ? ` · ${batch.recycled} recycled` : ""}
              {batch.total < batch.size ? ` · ${batch.size - batch.total} still minting` : ""}
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {canOpen ? (
            <>
              <Button size="sm" asChild>
                <Link href={stationHref(batch.templateId!, batch.id)}>
                  {!batch.unknown && batch.unbound === 0 && batch.bound > 0 ? (
                    <>
                      <Zap className="mr-1 h-3.5 w-3.5" /> Activate &amp; list
                    </>
                  ) : (
                    <>
                      Open station <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </>
                  )}
                </Link>
              </Button>
              <Button size="sm" variant="ghost" asChild>
                <Link href={batchWizardHref(batch.templateId!, batch.id)}>Batch wizard</Link>
              </Button>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">No template linked — open it from Catalog.</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
