"use client";

/**
 * Wizard step 1 — declare the batch (META-T34): quantity XOR CSV upload,
 * with the client-side validation preview (inline row errors) before
 * anything hits the server. POST /api/catalog-proxy/batches; a 400 row-error
 * response merges into the preview (server = enforcement point), a 201 hands
 * the created batch to the wizard (state='validated' → step 2).
 */

import { useMemo, useRef, useState } from "react";
import { Button, Input, Label } from "@tagit/ui";
import { FileUp, Hash, Loader2, Upload } from "lucide-react";

import { CsvPreviewTable } from "@/components/batch/csv-preview";
import {
  FORMULA_GUARD_IMPORT_COPY,
  MAX_BATCH_SIZE,
  attachServerErrors,
  buildCsvPreview,
  validateQuantity,
  type CsvPreview,
} from "@/lib/catalog/batch-logic";
import type { BatchCreateResponse, BatchDto, BatchRowError } from "@/lib/catalog/batch-types";

type Mode = "quantity" | "csv";

interface StepCreateProps {
  templateId: string;
  /** canMutateCatalog(role) — false renders the step read-only (viewer). */
  canCreate: boolean;
  onCreated: (batch: BatchDto) => void;
}

export function StepCreate({ templateId, canCreate, onCreated }: StepCreateProps) {
  const [mode, setMode] = useState<Mode>("quantity");
  const [quantity, setQuantity] = useState("");
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<BatchRowError[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const quantityCheck = useMemo(() => validateQuantity(quantity), [quantity]);

  const preview: CsvPreview | null = useMemo(() => {
    if (csvText.trim().length === 0) return null;
    const built = buildCsvPreview(csvText);
    return serverErrors.length > 0 ? attachServerErrors(built, serverErrors) : built;
  }, [csvText, serverErrors]);

  const canSubmit =
    canCreate &&
    !submitting &&
    (mode === "quantity" ? quantityCheck.quantity !== null : preview !== null && preview.ok);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setServerErrors([]);
    setError(null);
    setCsvText(await file.text());
  };

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setServerErrors([]);
    try {
      const res = await fetch("/api/catalog-proxy/batches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          mode === "quantity"
            ? { templateId, quantity: quantityCheck.quantity }
            : { templateId, csv: csvText },
        ),
      });
      const data = (await res.json()) as BatchCreateResponse;
      if (res.status === 400 && Array.isArray(data.errors) && data.errors.length > 0) {
        // Row-error preview from the services validator — nothing persisted.
        setServerErrors(data.errors);
        setError("The services validator rejected some rows — fixes are marked inline below.");
        return;
      }
      if (!res.ok || !data.ok || !data.batch) {
        throw new Error(data.error ?? data.message ?? `create failed (${res.status})`);
      }
      onCreated(data.batch);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {!canCreate && (
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Your role is read-only here — creating batches needs operator or admin.
        </div>
      )}

      {/* Mode toggle */}
      <div className="inline-flex rounded-md border p-0.5">
        {(
          [
            ["quantity", "Quantity", Hash],
            ["csv", "CSV upload", FileUp],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm ${
              mode === value ? "bg-secondary text-secondary-foreground" : "text-muted-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {mode === "quantity" ? (
        <div className="space-y-2 max-w-sm">
          <Label htmlFor="batch-quantity">Quantity (identical items off the template)</Label>
          <Input
            id="batch-quantity"
            inputMode="numeric"
            placeholder={`1–${MAX_BATCH_SIZE}`}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            disabled={!canCreate}
          />
          {quantity.length > 0 && quantityCheck.error && (
            <p className="text-xs text-destructive">{quantityCheck.error}</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={!canCreate}
            >
              <FileUp className="h-4 w-4 mr-2" />
              Choose CSV file
            </Button>
            {fileName && <span className="text-sm font-mono">{fileName}</span>}
            <span className="text-xs text-muted-foreground">…or paste below</span>
          </div>
          <textarea
            value={csvText}
            onChange={(e) => {
              setCsvText(e.target.value);
              setServerErrors([]);
            }}
            disabled={!canCreate}
            rows={6}
            spellCheck={false}
            placeholder={"serial,tag_uid,name_override,price_usdc\nSN-0001,,Limited #1,29.99"}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs"
          />
          {preview && <CsvPreviewTable preview={preview} />}
        </div>
      )}

      <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground space-y-1">
        <p>
          • Max {MAX_BATCH_SIZE} rows per batch — the whole batch mints as ONE on-chain batchMint
          transaction; split larger runs into several batches.
        </p>
        <p>
          • CSV columns: <span className="font-mono">serial</span> (required, unique),{" "}
          <span className="font-mono">tag_uid</span>, <span className="font-mono">name_override</span>
          , <span className="font-mono">price_usdc</span>. Strict RFC 4180 — quoted fields,{" "}
          <span className="font-mono">&quot;&quot;</span> escapes, no ragged rows.
        </p>
        <p>• {FORMULA_GUARD_IMPORT_COPY}</p>
        <p>• Nothing is persisted until every row validates (row errors show inline above).</p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button onClick={submit} disabled={!canSubmit}>
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Validating…
          </>
        ) : (
          <>
            <Upload className="h-4 w-4 mr-2" />
            Validate &amp; create batch
          </>
        )}
      </Button>
    </div>
  );
}
