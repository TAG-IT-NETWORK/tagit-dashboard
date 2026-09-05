"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, Zap } from "lucide-react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from "@tagit/ui";
import { usdc6ToDecimalInput } from "@/lib/catalog/template-logic";
import {
  activatableTokenIds,
  describeOutcome,
  parseActivateOutcome,
  validatePriceInput,
  type ActivateOutcome,
} from "@/lib/binding/activate";

/**
 * "Activate & list" — shown by the station once every token of the batch is
 * bound. One click takes every bound token to ACTIVATED through the relayer
 * and lists it at the price below (defaults to the template's price).
 * Safe to run again: already-active / already-listed tokens are skipped.
 */
export function ActivateListPanel({
  templateId,
  tokens,
  writable,
  onDone,
}: {
  templateId: string | null;
  tokens: ReadonlyArray<{ tokenId: string; lifecycle: string }>;
  writable: boolean;
  onDone?: () => void;
}) {
  const ids = activatableTokenIds(tokens);
  const [price, setPrice] = useState("");
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<ActivateOutcome | null>(null);
  const [usedPrice, setUsedPrice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Default price = the template's list price, if it has one.
  useEffect(() => {
    if (!templateId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/catalog-proxy/templates/${encodeURIComponent(templateId)}`, { cache: "no-store" });
        const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
        const tpl = (body?.template as Record<string, unknown> | undefined) ?? body ?? {};
        const dec = usdc6ToDecimalInput(typeof tpl.priceUsdc6 === "string" ? tpl.priceUsdc6 : null);
        if (!cancelled && dec) setPrice((prev) => (prev === "" ? dec : prev));
      } catch {
        /* no default price — operator types one */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [templateId]);

  const check = validatePriceInput(price);

  const run = async () => {
    if (!writable || ids.length === 0 || check.error) return;
    if (!armed) {
      setArmed(true);
      return;
    }
    setArmed(false);
    setBusy(true);
    setError(null);
    setOutcome(null);
    try {
      const res = await fetch("/api/catalog-proxy/binding/activate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tokenIds: ids, ...(check.priceUsdc ? { priceUsdc: check.priceUsdc } : {}) }),
      });
      const body = (await res.json().catch(() => null)) as unknown;
      const parsed = parseActivateOutcome(body);
      if (!res.ok && !parsed.ok) {
        setError(parsed.error ?? `Activation failed (HTTP ${res.status})`);
      }
      setOutcome(parsed);
      setUsedPrice(check.priceUsdc);
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-emerald-500/40">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Zap className="h-5 w-5 text-emerald-500" /> Activate &amp; list
            </CardTitle>
            <CardDescription>
              Every bound token goes ACTIVATED on-chain through the relayer, then is listed for sale at the price
              below. Already-active and already-listed tokens are skipped, so this is safe to run again.
            </CardDescription>
          </div>
          <Badge variant={ids.length > 0 ? "default" : "secondary"}>{ids.length} bound</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="activate-price" className="text-xs">List price (USDC)</Label>
            <Input
              id="activate-price"
              value={price}
              onChange={(e) => {
                setPrice(e.target.value);
                setArmed(false);
              }}
              placeholder="23.33"
              className="h-9 w-32 font-mono"
              disabled={busy}
            />
          </div>
          <Button onClick={() => void run()} disabled={!writable || busy || ids.length === 0 || !!check.error}>
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Zap className="mr-1 h-4 w-4" />}
            {busy
              ? "Working…"
              : armed
                ? `Confirm: activate ${ids.length}${check.priceUsdc ? ` + list at $${check.priceUsdc}` : ""}`
                : check.priceUsdc
                  ? `Activate & list ${ids.length}`
                  : `Activate ${ids.length} (no listing)`}
          </Button>
        </div>
        {check.error ? (
          <p className="text-xs text-destructive">{check.error}</p>
        ) : (
          <p className="text-xs text-muted-foreground">Leave the price empty to activate without listing.</p>
        )}
        {!writable && <p className="text-xs text-yellow-500">Operator role required.</p>}
        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
        )}
        {outcome && (
          <div className={`rounded-md border px-3 py-2 text-sm ${outcome.ok ? "border-green-500/40 bg-green-500/10" : "border-yellow-500/40 bg-yellow-500/10"}`}>
            <p className="mb-1 flex items-center gap-2 font-medium">
              <CheckCircle2 className={`h-4 w-4 ${outcome.ok ? "text-green-500" : "text-yellow-500"}`} />
              {outcome.ok ? "Done" : "Partly done"}
              {outcome.explorerUrl && (
                <a href={outcome.explorerUrl} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs underline">
                  tx <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </p>
            <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
              {describeOutcome(outcome, usedPrice).map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
