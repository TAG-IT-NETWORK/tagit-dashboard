"use client";

/**
 * Void + remint wizard (META-T35 → T26 recovery rail).
 *
 * Post-grace recovery for a bad bind: recycle(tokenId) on-chain via the
 * relayer, then remint the content as a fresh token (202 async mint). Two
 * explicit steps — mandatory reason, then a confirm screen that spells out
 * the irreversible recycle — and a result screen showing the replacement.
 */

import { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@tagit/ui";
import { AlertTriangle, CheckCircle2, Loader2, Recycle } from "lucide-react";

interface VoidRemintResult {
  recycleTxHash: string | null;
  mintRequestId: string | null;
  remintStatus: string | null;
  replacementTokenId: string | null;
}

interface VoidRemintWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Token the wizard voids — prefilled, editable while on the reason step. */
  initialTokenId: string;
  /** Notifies the station so the queue/log update (replacement may be null). */
  onVoided: (tokenId: string, replacementTokenId: string | null) => void;
}

type Step = "reason" | "confirm" | "done";

const TOKEN_ID_RE = /^\d+$/;

export function VoidRemintWizard({
  open,
  onOpenChange,
  initialTokenId,
  onVoided,
}: VoidRemintWizardProps) {
  const [step, setStep] = useState<Step>("reason");
  const [tokenId, setTokenId] = useState(initialTokenId);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VoidRemintResult | null>(null);

  const reset = (nextTokenId: string) => {
    setStep("reason");
    setTokenId(nextTokenId);
    setReason("");
    setBusy(false);
    setError(null);
    setResult(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (busy) return; // never close mid-broadcast
    if (next) reset(initialTokenId);
    onOpenChange(next);
  };

  const tokenValid = TOKEN_ID_RE.test(tokenId);
  const reasonValid = reason.trim().length > 0;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/catalog-proxy/binding/void-remint", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tokenId, reason: reason.trim() }),
      });
      const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!res.ok || body?.ok !== true) {
        setError(typeof body?.error === "string" ? body.error : `void-remint failed (${res.status})`);
        return;
      }
      const exception = (body.exception ?? {}) as Record<string, unknown>;
      const outcome: VoidRemintResult = {
        recycleTxHash: typeof body.recycleTxHash === "string" ? body.recycleTxHash : null,
        mintRequestId: typeof body.mintRequestId === "string" ? body.mintRequestId : null,
        remintStatus: typeof body.remintStatus === "string" ? body.remintStatus : null,
        replacementTokenId:
          typeof exception.replacementTokenId === "string" ? exception.replacementTokenId : null,
      };
      setResult(outcome);
      setStep("done");
      onVoided(tokenId, outcome.replacementTokenId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "void-remint request failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Recycle className="h-5 w-5" />
            Void + remint
          </DialogTitle>
          <DialogDescription>
            Recycles the token on-chain (irreversible) and remints its content as a fresh token.
            For binds past the anchor grace window.
          </DialogDescription>
        </DialogHeader>

        {step === "reason" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="vr-token">Token to void</Label>
              <Input
                id="vr-token"
                value={tokenId}
                onChange={(e) => setTokenId(e.target.value.trim())}
                className="font-mono"
                placeholder="e.g. 42"
              />
              {!tokenValid && tokenId.length > 0 && (
                <p className="text-xs text-destructive">Token id must be numeric.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="vr-reason">
                Reason <span className="text-destructive">*</span>
              </Label>
              <textarea
                id="vr-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                maxLength={2000}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Required — lands in the append-only exception log."
              />
            </div>
          </div>
        )}

        {step === "confirm" && (
          <div className="space-y-3">
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
              <p className="flex items-center gap-2 font-medium text-destructive">
                <AlertTriangle className="h-4 w-4" />
                This recycles token #{tokenId} on-chain. It cannot be undone.
              </p>
              <p className="mt-2 text-muted-foreground">
                The item content is carried into a replacement mint request; the recycled token
                stays in the registry as RECYCLED.
              </p>
            </div>
            <p className="text-sm">
              <span className="text-muted-foreground">Reason: </span>
              {reason.trim()}
            </p>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        {step === "done" && result && (
          <div className="space-y-3 text-sm">
            <p className="flex items-center gap-2 font-medium text-green-500">
              <CheckCircle2 className="h-4 w-4" />
              Token #{tokenId} voided — remint underway.
            </p>
            <dl className="space-y-1">
              <ResultRow label="New token">
                {result.replacementTokenId ? `#${result.replacementTokenId}` : "pending (async mint)"}
              </ResultRow>
              <ResultRow label="Mint request">{result.mintRequestId ?? "—"}</ResultRow>
              <ResultRow label="Remint status">{result.remintStatus ?? "—"}</ResultRow>
              {result.recycleTxHash && (
                <ResultRow label="Recycle tx">
                  <code className="text-xs">{result.recycleTxHash}</code>
                </ResultRow>
              )}
            </dl>
          </div>
        )}

        <DialogFooter>
          {step === "reason" && (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button disabled={!tokenValid || !reasonValid} onClick={() => setStep("confirm")}>
                Continue
              </Button>
            </>
          )}
          {step === "confirm" && (
            <>
              <Button variant="outline" disabled={busy} onClick={() => setStep("reason")}>
                Back
              </Button>
              <Button variant="destructive" disabled={busy} onClick={() => void submit()}>
                {busy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Recycling…
                  </>
                ) : (
                  <>Void token #{tokenId}</>
                )}
              </Button>
            </>
          )}
          {step === "done" && <Button onClick={() => handleOpenChange(false)}>Close</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResultRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="w-28 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-all">{children}</dd>
    </div>
  );
}
