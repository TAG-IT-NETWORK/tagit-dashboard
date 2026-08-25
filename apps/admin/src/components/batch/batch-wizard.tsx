"use client";

/**
 * /catalog/:id/batch wizard shell (META-T34).
 *
 * Three steps — 1 create/validate, 2 execute + mint progress, 3 label export
 * — where the CURRENT step is always derived from the batch's server-side
 * state (wizardStepForBatch), never from client memory. That makes the wizard
 * resumable across sessions: land here with ?batch=bat_… (or click a row in
 * the "Recent batches" rail, persisted per template in localStorage since
 * services ships no batch-list endpoint) and you re-enter mid-mint.
 *
 * All traffic goes through /api/catalog-proxy/batches* (admin + relayer keys
 * server-side, REQ-S-16 X-Actor forwarded); viewer role renders read-only.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@tagit/ui";
import { ArrowLeft, Loader2, Plus } from "lucide-react";

import { StepCreate } from "@/components/batch/step-create";
import { StepExport } from "@/components/batch/step-export";
import { StepMint } from "@/components/batch/step-mint";
import {
  WIZARD_STEPS,
  isBatchInFlight,
  parseRecentBatches,
  recentBatchesKey,
  upsertRecentBatch,
  wizardStepForBatch,
  wizardStepIndex,
  type RecentBatch,
  type WizardStep,
} from "@/lib/catalog/batch-logic";
import { canMutateCatalog, type CatalogRole } from "@/lib/catalog/template-logic";
import type { BatchDto, BatchProgress, BatchStatusResponse } from "@/lib/catalog/batch-types";

const POLL_MS = 2500;

const STEP_LABELS: Record<WizardStep, string> = {
  create: "1 · Declare",
  mint: "2 · Mint",
  export: "3 · Labels",
};

interface BatchWizardProps {
  templateId: string;
  role: CatalogRole | null;
  /** Pre-validated bat_… id from ?batch= (resume path), or null. */
  initialBatchId: string | null;
}

export function BatchWizard({ templateId, role, initialBatchId }: BatchWizardProps) {
  const router = useRouter();
  const [batchId, setBatchId] = useState<string | null>(initialBatchId);
  const [batch, setBatch] = useState<BatchDto | null>(null);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(initialBatchId !== null);
  const [templateName, setTemplateName] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentBatch[]>([]);
  const [pollNonce, setPollNonce] = useState(0);

  // Recent-batch memory (per template) — the cross-session "batch list".
  useEffect(() => {
    try {
      setRecent(parseRecentBatches(localStorage.getItem(recentBatchesKey(templateId))));
    } catch {
      setRecent([]);
    }
  }, [templateId]);

  const remember = useCallback(
    (b: BatchDto) => {
      setRecent((prev) => {
        const next = upsertRecentBatch(prev, {
          id: b.id,
          size: b.size,
          state: b.state,
          createdAt: b.createdAt,
        });
        try {
          localStorage.setItem(recentBatchesKey(templateId), JSON.stringify(next));
        } catch {
          // storage unavailable — the URL remains the resume path
        }
        return next;
      });
    },
    [templateId],
  );

  // Template name for the header (best-effort; the id is the fallback).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/catalog-proxy/templates/${templateId}`, { cache: "no-store" });
        const data = await res.json();
        if (!cancelled && res.ok && data.ok && data.template?.name) {
          setTemplateName(data.template.name as string);
        }
      } catch {
        // header degrades to the raw id
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [templateId]);

  const rememberRef = useRef(remember);
  rememberRef.current = remember;

  // Status load + poll-while-minting (T21/T25 202 pattern).
  useEffect(() => {
    if (batchId === null) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        const res = await fetch(`/api/catalog-proxy/batches/${batchId}`, { cache: "no-store" });
        const data = (await res.json()) as BatchStatusResponse;
        if (cancelled) return;
        if (!res.ok || !data.ok || !data.batch) {
          setStatusError(data.error ?? data.message ?? `status failed (${res.status})`);
          setLoadingStatus(false);
          return;
        }
        setBatch(data.batch);
        setProgress(data.progress ?? null);
        setStatusError(null);
        setLoadingStatus(false);
        rememberRef.current(data.batch);
        if (isBatchInFlight(data.batch.state)) {
          timer = setTimeout(() => void tick(), POLL_MS);
        }
      } catch (err) {
        if (cancelled) return;
        // Transient network failure mid-poll — keep trying.
        setStatusError(err instanceof Error ? err.message : "status poll failed");
        setLoadingStatus(false);
        timer = setTimeout(() => void tick(), POLL_MS);
      }
    };

    setLoadingStatus(true);
    void tick();
    return () => {
      cancelled = true;
      if (timer !== null) clearTimeout(timer);
    };
  }, [batchId, pollNonce]);

  const refresh = useCallback(() => setPollNonce((n) => n + 1), []);

  const selectBatch = useCallback(
    (id: string | null) => {
      setBatch(null);
      setProgress(null);
      setStatusError(null);
      setBatchId(id);
      router.replace(
        id === null ? `/catalog/${templateId}/batch` : `/catalog/${templateId}/batch?batch=${id}`,
        { scroll: false },
      );
    },
    [router, templateId],
  );

  const onCreated = useCallback(
    (b: BatchDto) => {
      setBatch(b);
      setProgress({ expected: b.size, minted: 0, tokens: [] });
      remember(b);
      setBatchId(b.id);
      router.replace(`/catalog/${templateId}/batch?batch=${b.id}`, { scroll: false });
    },
    [remember, router, templateId],
  );

  const step: WizardStep = batchId === null ? "create" : wizardStepForBatch(batch?.state ?? null);
  const stepIdx = wizardStepIndex(step);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Link
            href={`/catalog/${templateId}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {templateName ?? templateId}
          </Link>
          <h1 className="text-xl font-semibold">Batch mint</h1>
        </div>
        {batchId !== null && (
          <Button variant="outline" size="sm" onClick={() => selectBatch(null)}>
            <Plus className="h-4 w-4 mr-2" />
            New batch
          </Button>
        )}
      </div>

      {/* Step rail */}
      <ol className="flex items-center gap-2 text-sm">
        {WIZARD_STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            {i > 0 && <span className="text-muted-foreground">→</span>}
            <span
              className={`rounded-full px-3 py-1 ${
                s === step
                  ? "bg-primary text-primary-foreground"
                  : i < stepIdx
                    ? "bg-secondary text-secondary-foreground"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {STEP_LABELS[s]}
            </span>
          </li>
        ))}
        {batch && (
          <li className="ml-2 font-mono text-xs text-muted-foreground">
            {batch.id} · {batch.state}
          </li>
        )}
      </ol>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        {/* Active step */}
        <div>
          {batchId !== null && batch === null ? (
            loadingStatus ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading batch {batchId}…
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {statusError ?? "Batch not found."}
                </div>
                <Button variant="outline" size="sm" onClick={() => selectBatch(null)}>
                  Start a new batch
                </Button>
              </div>
            )
          ) : step === "create" ? (
            <StepCreate
              templateId={templateId}
              canCreate={canMutateCatalog(role)}
              onCreated={onCreated}
            />
          ) : batch !== null && step === "mint" ? (
            <StepMint
              batch={batch}
              progress={progress}
              role={role}
              canExecute={canMutateCatalog(role)}
              onRefresh={refresh}
            />
          ) : batch !== null ? (
            <StepExport templateId={templateId} batch={batch} progress={progress} />
          ) : null}
          {batch !== null && statusError !== null && (
            <p className="mt-2 text-xs text-destructive">status: {statusError}</p>
          )}
        </div>

        {/* Recent batches rail — resume rows (per-template, this browser) */}
        <aside className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Recent batches</h2>
          {recent.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              None yet in this browser. A batch is also resumable by URL:{" "}
              <span className="font-mono">?batch=bat_…</span>
            </p>
          ) : (
            <ul className="space-y-1">
              {recent.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => selectBatch(b.id)}
                    className={`w-full rounded-md border px-2 py-1.5 text-left text-xs hover:bg-accent ${
                      b.id === batchId ? "border-primary" : ""
                    }`}
                  >
                    <span className="block truncate font-mono">{b.id}</span>
                    <span className="text-muted-foreground">
                      {b.size} item{b.size === 1 ? "" : "s"} · {b.id === batch?.id ? batch.state : b.state}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
