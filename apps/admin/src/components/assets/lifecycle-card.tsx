"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Flag, Loader2, RefreshCw, Shield, Zap } from "lucide-react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from "@tagit/ui";
import { VoidRemintWizard } from "@/components/binding/void-remint-wizard";
import { validatePriceInput } from "@/lib/binding/activate";
import type { CatalogRole } from "@/lib/catalog/template-logic";
import {
  FORWARD_STATES,
  ST,
  availableActions,
  canRun,
  parseLifecycleStatus,
  stateLabel,
  summarizeOutcome,
  validateAddress,
  type ActionKind,
  type LifecycleAction,
  type LifecycleStatus,
  type Outcome,
} from "@/lib/lifecycle/logic";

/**
 * Lifecycle card — every state transition an operator/admin can make on one
 * asset, in one place, all through the services relayer (the connected
 * wallet never signs; it lost its capabilities in the key ceremony).
 */
export function LifecycleCard({
  tokenId,
  stateCode,
  role,
  onBind,
  onChanged,
}: {
  tokenId: string;
  /** On-chain state from wagmi (source of truth while the status loads). */
  stateCode: number | null;
  role: CatalogRole | null;
  onBind: () => void;
  onChanged: () => void;
}) {
  const [status, setStatus] = useState<LifecycleStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [price, setPrice] = useState("");
  const [address, setAddress] = useState("");
  const [armed, setArmed] = useState<ActionKind | null>(null);
  const [busy, setBusy] = useState<ActionKind | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [voidOpen, setVoidOpen] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/catalog-proxy/lifecycle/${tokenId}`, { cache: "no-store" });
      const body = (await res.json().catch(() => null)) as unknown;
      const parsed = parseLifecycleStatus(body);
      if (!res.ok || !parsed) {
        setStatusError(typeof (body as { error?: unknown })?.error === "string" ? ((body as { error: string }).error) : `status unavailable (HTTP ${res.status})`);
        return;
      }
      setStatus(parsed);
      setStatusError(null);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : String(err));
    }
  }, [tokenId]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const state = status?.state ?? stateCode;
  const saleState = status?.saleState ?? null;
  const actions = availableActions(state, saleState);
  const priceCheck = validatePriceInput(price);
  const addressCheck = validateAddress(address);

  const ready = (a: LifecycleAction): { ok: boolean; why: string | null } => {
    if (!canRun(a, role)) return { ok: false, why: a.tier === "admin" ? "admin role required" : "editor role required" };
    if (a.needsReason && reason.trim() === "") return { ok: false, why: "reason required" };
    if (a.needsPrice && !priceCheck.priceUsdc) return { ok: false, why: priceCheck.error ?? "price required" };
    if (a.needsAddress && !addressCheck.address) return { ok: false, why: addressCheck.error };
    return { ok: true, why: null };
  };

  const run = async (a: LifecycleAction) => {
    if (a.kind === "bind") {
      onBind();
      return;
    }
    if (a.kind === "void-remint") {
      setVoidOpen(true);
      return;
    }
    if (!ready(a).ok || busy) return;
    if (a.irreversible && armed !== a.kind) {
      setArmed(a.kind);
      return;
    }
    setArmed(null);
    setBusy(a.kind);
    setOutcome(null);
    const trimmedReason = reason.trim();
    let path = "";
    let method = "POST";
    let payload: Record<string, unknown> = {};
    switch (a.kind) {
      case "activate":
        path = "/api/catalog-proxy/binding/activate";
        payload = { tokenIds: [tokenId] };
        break;
      case "list":
        path = "/api/catalog-proxy/binding/activate";
        payload = { tokenIds: [tokenId], priceUsdc: priceCheck.priceUsdc };
        break;
      case "update-price":
        path = `/api/catalog-proxy/assets/${tokenId}/price`;
        method = "PUT";
        payload = { action: "UPDATE", priceUsdc: priceCheck.priceUsdc };
        break;
      case "delist":
        path = `/api/catalog-proxy/assets/${tokenId}/price`;
        method = "PUT";
        payload = { action: "DELIST", reason: trimmedReason };
        break;
      case "settle":
        path = "/api/catalog-proxy/sale/settle";
        payload = { tokenId, buyerWallet: addressCheck.address };
        break;
      case "flag":
        path = "/api/catalog-proxy/lifecycle/flag";
        payload = { tokenIds: [tokenId], reason: trimmedReason };
        break;
      case "resolve":
        path = "/api/catalog-proxy/lifecycle/resolve";
        payload = { tokenId, reason: trimmedReason, ...(addressCheck.address ? { newOwner: addressCheck.address } : {}) };
        break;
      case "recycle":
        path = "/api/catalog-proxy/lifecycle/recycle";
        payload = { tokenId, reason: trimmedReason };
        break;
      default:
        setBusy(null);
        return;
    }
    try {
      const res = await fetch(path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const body = (await res.json().catch(() => null)) as unknown;
      const summary = summarizeOutcome(a.kind, body, res.ok);
      setOutcome(summary);
      if (summary.ok) {
        setReason("");
        onChanged();
      }
      await loadStatus();
    } catch (err) {
      setOutcome({ ok: false, lines: [err instanceof Error ? err.message : String(err)], explorerUrl: null });
    } finally {
      setBusy(null);
    }
  };

  const group = (g: LifecycleAction["group"]) => actions.filter((a) => a.group === g);
  const needsReason = actions.some((a) => a.needsReason);
  const needsPrice = actions.some((a) => a.needsPrice);
  const needsAddress = actions.some((a) => a.needsAddress) || (state === ST.FLAGGED && status?.preFlagState === ST.CLAIMED);

  return (
    <Card className="border-emerald-500/30">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-emerald-500" /> Lifecycle
            </CardTitle>
            <CardDescription>
              Every move runs through the services relayer. Reason lines land in the audit log.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {saleState && (
              <Badge variant="secondary" className={saleState === "listed" ? "bg-green-500/10 text-green-500" : ""}>
                {saleState === "listed" ? "listed" : saleState === "sold" ? "sold" : "not for sale"}
              </Badge>
            )}
            <Button size="sm" variant="ghost" onClick={() => void loadStatus()} title="Refresh status">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* State strip */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {FORWARD_STATES.map((code, i) => {
            const current = state === code;
            const done = state !== null && state !== ST.FLAGGED && state !== ST.RECYCLED && state > code;
            const donePre = state === ST.FLAGGED && status?.preFlagState !== null && status?.preFlagState !== undefined && status.preFlagState >= code;
            return (
              <span key={code} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-muted-foreground">→</span>}
                <span
                  className={`rounded-full border px-2.5 py-0.5 font-mono ${
                    current
                      ? "border-emerald-500 bg-emerald-500/15 text-emerald-500"
                      : done || donePre
                        ? "border-emerald-500/30 text-emerald-500/70"
                        : "border-border text-muted-foreground"
                  }`}
                >
                  {stateLabel(code)}
                </span>
              </span>
            );
          })}
          <span className="mx-1 h-4 w-px bg-border" aria-hidden />
          <span className={`rounded-full border px-2.5 py-0.5 font-mono ${state === ST.FLAGGED ? "border-red-500 bg-red-500/15 text-red-500" : "border-border text-muted-foreground"}`}>
            FLAGGED{state === ST.FLAGGED && status?.preFlagStateName ? ` (was ${status.preFlagStateName})` : ""}
          </span>
          <span className={`rounded-full border px-2.5 py-0.5 font-mono ${state === ST.RECYCLED ? "border-zinc-400 bg-zinc-500/15 text-zinc-300" : "border-border text-muted-foreground"}`}>
            RECYCLED
          </span>
        </div>

        {statusError && (
          <p className="text-xs text-yellow-500">Relayer status unavailable: {statusError}. Buttons use the on-chain state only.</p>
        )}

        {/* Resolve round */}
        {state === ST.FLAGGED && status && (
          <div className="rounded-md border border-red-500/40 bg-red-500/5 px-3 py-2 text-sm">
            <p className="flex items-center gap-2 font-medium text-red-500">
              <Flag className="h-4 w-4" /> Flagged — resolve needs {status.quorum} RESOLVER approvals
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Approvals {status.approvals ?? 0}/{status.quorum}
              {status.recipient && status.recipient !== "0x0000000000000000000000000000000000000000" ? ` · recipient locked to ${status.recipient}` : ""}
              {status.quorumReached ? " · quorum reached — press Resolve to finish" : ""}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Resolve casts the relayer&apos;s approval and finishes once the quorum is met. The second approval comes from another
              RESOLVER wallet on the{" "}
              <Link href={`/resolve/${tokenId}`} className="underline">
                resolve page
              </Link>
              .
            </p>
          </div>
        )}

        {/* Inputs */}
        {(needsReason || needsPrice || needsAddress) && (
          <div className="grid gap-3 sm:grid-cols-3">
            {needsReason && (
              <div className="space-y-1 sm:col-span-1">
                <Label htmlFor="lc-reason" className="text-xs">Reason (audit)</Label>
                <Input id="lc-reason" value={reason} onChange={(e) => { setReason(e.target.value); setArmed(null); }} placeholder="e.g. customer reported stolen" />
              </div>
            )}
            {needsPrice && (
              <div className="space-y-1">
                <Label htmlFor="lc-price" className="text-xs">Price (USDC)</Label>
                <Input id="lc-price" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="23.33" className="font-mono" />
                {price && priceCheck.error && <p className="text-xs text-destructive">{priceCheck.error}</p>}
              </div>
            )}
            {needsAddress && (
              <div className="space-y-1">
                <Label htmlFor="lc-address" className="text-xs">{state === ST.FLAGGED ? "Recipient (optional, CLAIMED only)" : "Customer wallet"}</Label>
                <Input id="lc-address" value={address} onChange={(e) => { setAddress(e.target.value); setArmed(null); }} placeholder="0x…" className="font-mono text-xs" />
                {address && addressCheck.error && <p className="text-xs text-destructive">{addressCheck.error}</p>}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        {actions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {state === ST.RECYCLED ? "Recycled — terminal state, nothing more to do." : "No actions for this state."}
          </p>
        ) : (
          <div className="space-y-3">
            {(["forward", "sale", "exception"] as const).map((g) => {
              const items = group(g);
              if (items.length === 0) return null;
              return (
                <div key={g}>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {g === "forward" ? "Next step" : g === "sale" ? "Sale" : "Exceptions"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {items.map((a) => {
                      const r = ready(a);
                      const isBusy = busy === a.kind;
                      const isArmed = armed === a.kind;
                      const destructive = a.kind === "recycle" || a.kind === "flag" || a.kind === "void-remint";
                      return (
                        <div key={a.kind} className="flex flex-col gap-0.5">
                          <Button
                            size="sm"
                            variant={g === "forward" ? "default" : destructive ? "destructive" : "outline"}
                            disabled={(!r.ok && a.kind !== "bind" && a.kind !== "void-remint") || busy !== null}
                            onClick={() => void run(a)}
                            title={a.hint}
                          >
                            {isBusy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : g === "forward" ? <Zap className="mr-1 h-3.5 w-3.5" /> : null}
                            {isBusy ? "Working…" : isArmed ? `Confirm ${a.label.toLowerCase()} #${tokenId}` : a.label}
                          </Button>
                          {!r.ok && a.kind !== "bind" && a.kind !== "void-remint" && <span className="text-[11px] text-muted-foreground">{r.why}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {outcome && (
          <div className={`rounded-md border px-3 py-2 text-sm ${outcome.ok ? "border-green-500/40 bg-green-500/10" : "border-destructive/50 bg-destructive/10"}`}>
            <p className="flex items-center gap-2 font-medium">
              {outcome.ok ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <AlertTriangle className="h-4 w-4 text-destructive" />}
              {outcome.ok ? "Done" : "Failed"}
              {outcome.explorerUrl && (
                <a href={outcome.explorerUrl} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs underline">
                  tx <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
              {outcome.lines.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>

      <VoidRemintWizard
        open={voidOpen}
        onOpenChange={setVoidOpen}
        initialTokenId={tokenId}
        onVoided={() => {
          setVoidOpen(false);
          onChanged();
          void loadStatus();
        }}
      />
    </Card>
  );
}
