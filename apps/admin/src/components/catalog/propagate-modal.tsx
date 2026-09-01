"use client";

/**
 * Propagate checklist modal (META-T33 → T24 job).
 *
 * POST /api/catalog-proxy/templates/:id/propagate (202 { jobId }) then polls
 * /api/catalog-proxy/propagate-jobs/:jobId until the job leaves 'running'.
 * The job row carries cursor + per-outcome counters; anchor transactions per
 * item are broadcast asynchronously by the services anchor worker (the job
 * DTO carries no tx hashes — per-item links below go to the verify page,
 * where each anchor tx surfaces once confirmed).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@tagit/ui";
import { CheckCircle2, ExternalLink, Loader2, Send, XCircle } from "lucide-react";

import type { PropagateJobDto, TemplateDto } from "@/lib/catalog/template-types";

import { upstreamErrorMessage } from "@/lib/upstream-error";

const VERIFY_URL = process.env.NEXT_PUBLIC_VERIFY_URL || "https://verify.tagit.network";
const POLL_MS = 2500;

interface PropagateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: TemplateDto;
  /** Latest published snapshot version (propagation target). */
  targetVersion: number;
  /** Token ids currently loaded in the Items table (subset scope option). */
  loadedTokenIds: string[];
}

type Scope = "all" | "loaded";

export function PropagateModal({
  open,
  onOpenChange,
  template,
  targetVersion,
  loadedTokenIds,
}: PropagateModalProps) {
  const [scope, setScope] = useState<Scope>("all");
  const [acknowledged, setAcknowledged] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<PropagateJobDto | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Reset when reopened for a fresh run.
  useEffect(() => {
    if (open) return;
    stopPolling();
    setAcknowledged(false);
    setStarting(false);
    setError(null);
    setJobId(null);
    setJob(null);
  }, [open, stopPolling]);

  useEffect(() => stopPolling, [stopPolling]);

  const poll = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/catalog-proxy/propagate-jobs/${id}`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.ok && data.job) {
        const next = data.job as PropagateJobDto;
        setJob(next);
        if (next.state !== "running") return; // terminal — stop polling
      }
    } catch {
      // transient poll failure — keep trying
    }
    timerRef.current = setTimeout(() => void poll(id), POLL_MS);
  }, []);

  const start = async () => {
    if (!acknowledged || starting) return;
    setStarting(true);
    setError(null);
    try {
      const res = await fetch(`/api/catalog-proxy/templates/${template.id}/propagate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          scope === "loaded" && loadedTokenIds.length > 0 ? { tokenIds: loadedTokenIds } : {},
        ),
      });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.jobId) {
        throw new Error(upstreamErrorMessage(data, res.status, "propagate"));
      }
      setJobId(data.jobId as string);
      void poll(data.jobId as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Propagate failed");
    } finally {
      setStarting(false);
    }
  };

  const scopeCount = scope === "loaded" ? loadedTokenIds.length : null;
  const done = job !== null && job.state !== "running";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Propagate template</DialogTitle>
          <DialogDescription>
            Re-render adopted items onto the latest published snapshot.
          </DialogDescription>
        </DialogHeader>

        {jobId === null ? (
          <div className="space-y-4">
            {/* Checklist */}
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between gap-4">
                <span className="text-muted-foreground">Template</span>
                <span className="font-medium truncate">
                  {template.name} <span className="font-mono text-xs">({template.id})</span>
                </span>
              </li>
              <li className="flex justify-between gap-4">
                <span className="text-muted-foreground">Target snapshot</span>
                <span className="font-mono">
                  v{targetVersion}
                  {targetVersion > 1 && (
                    <span className="text-muted-foreground"> (from ≤ v{targetVersion - 1})</span>
                  )}
                </span>
              </li>
              <li className="flex justify-between gap-4 items-center">
                <span className="text-muted-foreground">Item scope</span>
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value as Scope)}
                  className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
                >
                  <option value="all">All adopted items</option>
                  <option value="loaded" disabled={loadedTokenIds.length === 0}>
                    {loadedTokenIds.length > 0
                      ? `${loadedTokenIds.length} loaded token id${loadedTokenIds.length === 1 ? "" : "s"}`
                      : "Loaded ids (load items first)"}
                  </option>
                </select>
              </li>
            </ul>
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground space-y-1">
              <p>• Explicit action — publishing never propagates implicitly.</p>
              <p>
                • Every changed item gets a new metadata version and its anchor re-queues — one
                relayer-funded transaction per item (grace 0).
              </p>
              <p>
                • The job is chunked and resumable; unchanged items are skipped byte-identically.
              </p>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Re-render{" "}
                {scopeCount !== null
                  ? `${scopeCount} item${scopeCount === 1 ? "" : "s"}`
                  : "every adopted item"}{" "}
                onto v{targetVersion} and re-queue anchors.
              </span>
            </label>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Job progress */}
            <div className="flex items-center gap-2 text-sm">
              {done ? (
                job?.error ? (
                  <XCircle className="h-4 w-4 text-destructive" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                )
              ) : (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              <span className="font-mono text-xs">{jobId}</span>
              <span className="text-muted-foreground">{job?.state ?? "starting…"}</span>
            </div>
            {job && (
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                <span className="text-muted-foreground">Processed</span>
                <span className="font-mono">{job.processed}</span>
                <span className="text-muted-foreground">Updated (re-anchored)</span>
                <span className="font-mono">{job.updatedCount}</span>
                <span className="text-muted-foreground">Unchanged</span>
                <span className="font-mono">{job.unchangedCount}</span>
                <span className="text-muted-foreground">Skipped</span>
                <span className="font-mono">{job.skippedCount}</span>
                {job.cursor !== null && (
                  <>
                    <span className="text-muted-foreground">Cursor (last token)</span>
                    <span className="font-mono">#{job.cursor}</span>
                  </>
                )}
              </div>
            )}
            {job?.error && <p className="text-xs text-destructive">{job.error}</p>}
            {done && !job?.error && (
              <p className="text-xs text-muted-foreground">
                Anchor transactions broadcast asynchronously — each item&apos;s tx appears on its
                verify page once confirmed.
              </p>
            )}
            {scope === "loaded" && loadedTokenIds.length > 0 && (
              <div className="flex flex-wrap gap-2 text-xs">
                {loadedTokenIds.slice(0, 20).map((id) => (
                  <a
                    key={id}
                    href={`${VERIFY_URL}/asset/${id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center font-mono text-muted-foreground hover:text-foreground"
                  >
                    #{id}
                    <ExternalLink className="h-3 w-3 ml-0.5" />
                  </a>
                ))}
                {loadedTokenIds.length > 20 && (
                  <span className="text-muted-foreground">+{loadedTokenIds.length - 20} more</span>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {jobId === null ? (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={start} disabled={!acknowledged || starting}>
                {starting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Starting…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Start propagate
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button variant={done ? "default" : "ghost"} onClick={() => onOpenChange(false)}>
              {done ? "Close" : "Run in background"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
