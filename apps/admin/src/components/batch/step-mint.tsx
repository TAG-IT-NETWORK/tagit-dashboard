"use client";

/**
 * Wizard step 2 — execute + mint progress (META-T34).
 *
 * Execute: POST /api/catalog-proxy/batches/:id/execute {to} → 202 (T21/T25
 * async pattern); the wizard polls GET status and per-token rows stream in
 * below as the services continuation inserts them. Idempotent server-side —
 * re-clicking a minting/minted batch starts nothing new. mint_failed is
 * retryable (same button). A batch stuck in 'minting' past the stale window
 * surfaces the ADMIN-ONLY Unstick action (resolves state from the chain,
 * broadcasts nothing).
 */

import { useEffect, useState } from "react";
import { Button, Input, Label } from "@tagit/ui";
import { AlertTriangle, ExternalLink, Loader2, Play, Wrench } from "lucide-react";

import {
  basescanTxUrl,
  canExecuteBatch,
  canUnstickBatch,
  isBatchInFlight,
} from "@/lib/catalog/batch-logic";
import type { CatalogRole } from "@/lib/catalog/template-logic";
import type {
  BatchDto,
  BatchExecuteResponse,
  BatchProgress,
  BatchUnstickResponse,
} from "@/lib/catalog/batch-types";

const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;
const MINT_TO_STORAGE_KEY = "tagit.admin.batch.mintTo";

interface StepMintProps {
  batch: BatchDto;
  progress: BatchProgress | null;
  role: CatalogRole | null;
  /** canMutateCatalog(role) — execute gate (proxy re-checks server-side). */
  canExecute: boolean;
  /** Re-poll the batch status now (after execute/unstick). */
  onRefresh: () => void;
}

export function StepMint({ batch, progress, role, canExecute, onRefresh }: StepMintProps) {
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState<"execute" | "unstick" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unstickNote, setUnstickNote] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(MINT_TO_STORAGE_KEY);
      if (saved && ADDR_RE.test(saved)) setTo(saved);
    } catch {
      // storage unavailable — leave the field empty
    }
  }, []);

  const executable = canExecute && canExecuteBatch(batch.state);
  const inFlight = isBatchInFlight(batch.state);
  const msSinceUpdate = Date.now() - Date.parse(batch.updatedAt);
  const unstickable = canUnstickBatch(role, batch.state, msSinceUpdate);

  const execute = async () => {
    if (!executable || busy !== null || !ADDR_RE.test(to)) return;
    setBusy("execute");
    setError(null);
    setUnstickNote(null);
    try {
      localStorage.setItem(MINT_TO_STORAGE_KEY, to);
    } catch {
      // best-effort convenience only
    }
    try {
      const res = await fetch(`/api/catalog-proxy/batches/${batch.id}/execute`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to }),
      });
      const data = (await res.json()) as BatchExecuteResponse;
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? data.message ?? `execute failed (${res.status})`);
      }
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Execute failed");
    } finally {
      setBusy(null);
    }
  };

  const unstick = async () => {
    if (!unstickable || busy !== null) return;
    setBusy("unstick");
    setError(null);
    try {
      const res = await fetch(`/api/catalog-proxy/batches/${batch.id}/unstick`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const data = (await res.json()) as BatchUnstickResponse;
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? data.message ?? `unstick failed (${res.status})`);
      }
      setUnstickNote(
        data.action === "finalized_from_receipt"
          ? "The mint had already landed on-chain — rows finalized from the receipt."
          : data.action === "in_flight"
            ? "The services process is still actively minting — not stuck."
            : `Batch reset to mint_failed (${data.action ?? "reset"}) — execute again to retry.`,
      );
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unstick failed");
    } finally {
      setBusy(null);
    }
  };

  const minted = progress?.minted ?? 0;
  const expected = progress?.expected ?? batch.size;
  const pct = expected > 0 ? Math.round((minted / expected) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Execute controls */}
      {canExecuteBatch(batch.state) && (
        <div className="space-y-2 max-w-lg">
          <Label htmlFor="mint-to">Mint recipient (treasury/admin address holding the batch pre-bind)</Label>
          <div className="flex gap-2">
            <Input
              id="mint-to"
              placeholder="0x…"
              value={to}
              onChange={(e) => setTo(e.target.value.trim())}
              disabled={!executable || busy !== null}
              className="font-mono"
            />
            <Button onClick={execute} disabled={!executable || busy !== null || !ADDR_RE.test(to)}>
              {busy === "execute" ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Starting…
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  {batch.state === "mint_failed" ? "Retry mint" : "Mint batch"}
                </>
              )}
            </Button>
          </div>
          {to.length > 0 && !ADDR_RE.test(to) && (
            <p className="text-xs text-destructive">Must be a 0x EVM address.</p>
          )}
          <p className="text-xs text-muted-foreground">
            One relayer-funded batchMint transaction for all {batch.size} tokens (202 — progress
            streams in below). Safe to leave and come back: this batch resumes from its row or URL.
          </p>
        </div>
      )}
      {!canExecute && canExecuteBatch(batch.state) && (
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Your role is read-only here — executing needs operator or admin.
        </div>
      )}

      {batch.state === "mint_failed" && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            The last mint attempt failed and the batch is retryable. Retrying is double-mint safe:
            the services side re-checks any recorded broadcast&apos;s receipt before rebroadcasting.
          </span>
        </div>
      )}

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            {inFlight && <Loader2 className="h-4 w-4 animate-spin" />}
            {inFlight ? "Minting…" : batch.state === "validated" ? "Awaiting execute" : batch.state}
          </span>
          <span className="font-mono text-xs">
            {minted}/{expected} minted
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        {batch.txHash && (
          <a
            href={basescanTxUrl(batch.txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground"
          >
            batchMint tx {batch.txHash.slice(0, 10)}…{batch.txHash.slice(-8)}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {/* Unstick (admin-only, stale 'minting' only) */}
      {inFlight && role === "admin" && (
        <div className="space-y-2">
          <Button variant="outline" size="sm" onClick={unstick} disabled={!unstickable || busy !== null}>
            {busy === "unstick" ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Resolving from chain…
              </>
            ) : (
              <>
                <Wrench className="h-4 w-4 mr-2" />
                Unstick batch
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground">
            {unstickable
              ? "No progress for a while — Unstick resolves the true state from the chain (broadcasts nothing): a landed tx finalizes, anything else resets to a retryable failure."
              : "Unstick unlocks if a batch sits in 'minting' with no progress for 3 minutes (admin only)."}
          </p>
        </div>
      )}
      {unstickNote && <p className="text-sm text-muted-foreground">{unstickNote}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Per-token rows, streaming in as the continuation inserts them */}
      {progress && progress.tokens.length > 0 && (
        <div className="max-h-96 overflow-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background">
              <tr className="border-b bg-muted/40 text-left">
                <th className="px-2 py-1.5 font-medium text-muted-foreground">Token</th>
                <th className="px-2 py-1.5 font-medium text-muted-foreground">Serial</th>
                <th className="px-2 py-1.5 font-medium text-muted-foreground">Tag UID</th>
                <th className="px-2 py-1.5 font-medium text-muted-foreground">Lifecycle</th>
              </tr>
            </thead>
            <tbody>
              {progress.tokens.map((t) => (
                <tr key={t.tokenId} className="border-b last:border-0">
                  <td className="px-2 py-1.5 font-mono text-xs">#{t.tokenId}</td>
                  <td className="px-2 py-1.5 font-mono text-xs break-all">{t.serial ?? "—"}</td>
                  <td className="px-2 py-1.5 font-mono text-xs break-all">{t.tagUid ?? "—"}</td>
                  <td className="px-2 py-1.5 text-xs">{t.lifecycle}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
