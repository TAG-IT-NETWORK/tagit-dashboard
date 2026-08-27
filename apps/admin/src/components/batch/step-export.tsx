"use client";

/**
 * Wizard step 3 — label export + binding handoff (META-T34). The download is
 * a plain navigation to the export proxy (attachment Content-Disposition);
 * the CSV itself is rendered upstream (tokenId,tagUid,serial,verifyUrl —
 * every cell quoted + formula-neutralized, REQ-S-29 export guard).
 */

import Link from "next/link";
import { Button } from "@tagit/ui";
import { ArrowRight, CheckCircle2, Download, ExternalLink } from "lucide-react";

import { FORMULA_GUARD_EXPORT_COPY, basescanTxUrl } from "@/lib/catalog/batch-logic";
import type { BatchDto, BatchProgress } from "@/lib/catalog/batch-types";

interface StepExportProps {
  templateId: string;
  batch: BatchDto;
  progress: BatchProgress | null;
}

export function StepExport({ templateId, batch, progress }: StepExportProps) {
  const minted = progress?.minted ?? batch.size;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <CheckCircle2 className="h-4 w-4 text-green-500" />
        <span>
          {minted} token{minted === 1 ? "" : "s"} minted
          {batch.tokenStart !== null && batch.tokenEnd !== null && (
            <span className="font-mono text-xs text-muted-foreground">
              {" "}
              (#{batch.tokenStart}–#{batch.tokenEnd})
            </span>
          )}
        </span>
        {batch.txHash && (
          <a
            href={basescanTxUrl(batch.txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground"
          >
            tx
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      <div className="space-y-2">
        <Button asChild>
          <a href={`/api/catalog-proxy/batches/${batch.id}/export.csv`} download>
            <Download className="h-4 w-4 mr-2" />
            Download labels CSV
          </a>
        </Button>
        <p className="text-xs text-muted-foreground">
          Columns: <span className="font-mono">tokenId,tagUid,serial,verifyUrl</span> — one row per
          minted token, ready for the label printer.
        </p>
        <p className="text-xs text-muted-foreground">{FORMULA_GUARD_EXPORT_COPY}</p>
      </div>

      <div className="rounded-md border bg-muted/40 px-3 py-3 text-sm space-y-2">
        <p className="font-medium">Next: bind tags</p>
        <p className="text-xs text-muted-foreground">
          Tokens minted to the treasury address stay pre-bind until each physical tag is attached at
          the binding station.
        </p>
        {/* META-T35 binding station — lives under the wizard route (/batch/bind). */}
        <Link
          href={`/catalog/${templateId}/batch/bind?batch=${batch.id}`}
          className="inline-flex items-center gap-1 text-sm underline underline-offset-4"
        >
          Hand off to binding station
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
