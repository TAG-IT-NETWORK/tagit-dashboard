"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  cn,
} from "@tagit/ui";
import { Bell, CheckCircle2, Siren, Zap } from "lucide-react";
import { listBatches, recallByBatch, type ProvNode } from "@/lib/provenance";

export function RecallDialog({
  open,
  onOpenChange,
  forest,
  initialBatch,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  forest: ProvNode[];
  initialBatch?: string;
}) {
  const batches = useMemo(() => listBatches(forest), [forest]);
  const [batch, setBatch] = useState<string | null>(initialBatch ?? null);
  const [notified, setNotified] = useState(false);

  useEffect(() => {
    if (open) {
      setBatch(initialBatch ?? batches.find((b) => b.flagged)?.batch ?? batches[0]?.batch ?? null);
      setNotified(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialBatch]);

  const hits = useMemo(() => (batch ? recallByBatch(forest, batch) : []), [batch, forest]);
  const ownerCount = hits.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Siren className="h-5 w-5 text-red-600" />
            Recall command
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Simulated
            </span>
          </DialogTitle>
          <DialogDescription>
            Select a component batch. Every product containing it is identified across the entire
            forest in one pass — the whitepaper&apos;s 60-second recall. The notification step below
            is a preview; no transaction is sent.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">
              Component batch / lot
            </div>
            {batches.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No batches present in the current forest.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {batches.map(({ batch: b, flagged }) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => {
                      setBatch(b);
                      setNotified(false);
                    }}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-sm font-medium",
                      batch === b
                        ? "bg-primary text-primary-foreground"
                        : flagged
                          ? "bg-red-500/10 text-red-600 hover:bg-red-500/20"
                          : "bg-secondary text-secondary-foreground hover:bg-accent",
                    )}
                  >
                    {b}
                    {flagged && " ⚠"}
                  </button>
                ))}
              </div>
            )}
          </div>

          {batch && (
            <div className="rounded-lg border bg-secondary/30 p-4">
              <div className="flex items-center gap-2 text-sm">
                <Zap className="h-4 w-4 text-amber-500" />
                <span className="font-medium">
                  {ownerCount} affected product{ownerCount === 1 ? "" : "s"} identified
                </span>
                <span className="text-muted-foreground">· batch {batch}</span>
              </div>

              {ownerCount > 0 && (
                <ul className="mt-3 space-y-2">
                  {hits.map(({ root, affected }) => (
                    <li key={root.id} className="text-sm">
                      <span className="font-medium">{root.label}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        — contains {affected.map((a) => a.label).join(", ")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {notified && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Preview only — no transaction was sent. In production this routes the {ownerCount}{" "}
                affected product{ownerCount === 1 ? "" : "s"} to FLAGGED via an on-chain{" "}
                <code>flag()</code> call and notifies each owner agent.
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            variant="destructive"
            disabled={!batch || ownerCount === 0 || notified}
            onClick={() => setNotified(true)}
          >
            <Bell className="mr-2 h-4 w-4" />
            Preview recall notice ({ownerCount})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
