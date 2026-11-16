"use client";

/**
 * Wizard step 1 — declare the batch (META-T34): quantity XOR CSV upload,
 * with the client-side validation preview (inline row errors) before
 * anything hits the server. POST /api/catalog-proxy/batches; a 400 row-error
 * response merges into the preview (server = enforcement point), a 201 hands
 * the created batch to the wizard (state='validated' → step 2).
 *
 * Batch details (TAP-T09): for a cosmetics product the step also takes the lot
 * number and the made-on and best-before dates that every item of the batch
 * shares. They are written into each item when the batch is minted and shown
 * to shoppers on the product page.
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
import {
  EMPTY_BATCH_FACTS_DRAFT,
  FACT_LIMITS,
  readBatchFactsDraft,
  type BatchFactField,
  type BatchFactsDraft,
} from "@/lib/catalog/product-facts";

type Mode = "quantity" | "csv";

interface StepCreateProps {
  templateId: string;
  /** canMutateCatalog(role) — false renders the step read-only (viewer). */
  canCreate: boolean;
  /**
   * The batch may carry lot / made-on / best-before: the product the items
   * will be minted from is cosmetics and the API knows about facts.
   */
  factsAvailable: boolean;
  onCreated: (batch: BatchDto) => void;
}

export function StepCreate({ templateId, canCreate, factsAvailable, onCreated }: StepCreateProps) {
  const [mode, setMode] = useState<Mode>("quantity");
  const [quantity, setQuantity] = useState("");
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<BatchRowError[]>([]);
  const [factsDraft, setFactsDraft] = useState<BatchFactsDraft>(EMPTY_BATCH_FACTS_DRAFT);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const quantityCheck = useMemo(() => validateQuantity(quantity), [quantity]);

  const preview: CsvPreview | null = useMemo(() => {
    if (csvText.trim().length === 0) return null;
    const built = buildCsvPreview(csvText);
    return serverErrors.length > 0 ? attachServerErrors(built, serverErrors) : built;
  }, [csvText, serverErrors]);

  const factsRead = useMemo(() => readBatchFactsDraft(factsDraft), [factsDraft]);
  const factsValid = !factsAvailable || Object.keys(factsRead.errors).length === 0;
  const setFact = (field: BatchFactField, value: string) => {
    setFactsDraft((d) => ({ ...d, [field]: value }));
    setError(null);
  };

  const canSubmit =
    canCreate &&
    !submitting &&
    factsValid &&
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
        body: JSON.stringify({
          ...(mode === "quantity"
            ? { templateId, quantity: quantityCheck.quantity }
            : { templateId, csv: csvText }),
          ...(factsAvailable && factsRead.facts ? { facts: factsRead.facts } : {}),
        }),
      });
      const data = (await res.json()) as BatchCreateResponse;
      if (res.status === 400 && Array.isArray(data.errors) && data.errors.length > 0) {
        // Row-error preview from the services validator — nothing persisted.
        setServerErrors(data.errors);
        setError("The services validator rejected some rows — fixes are marked inline below.");
        return;
      }
      if (!res.ok || !data.ok || !data.batch) {
        // Services answers with {error: CODE, message: "what went wrong"}; the
        // proxy's own refusals carry the sentence in `error`. Prefer the sentence.
        throw new Error(data.message ?? data.error ?? `create failed (${res.status})`);
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

      {/* Batch details (TAP-T09) — cosmetics only */}
      {factsAvailable && (
        // Date fields carry color-scheme so the browser draws the native
        // calendar button and popup for the console's dark surface.
        <fieldset className="min-w-0 space-y-3 rounded-md border p-4" data-testid="batch-facts">
          <legend className="px-1 text-sm font-medium">Batch details</legend>
          <p className="text-xs text-muted-foreground">
            Optional. The same for every item in this batch, and shown to shoppers on the product
            page. They cannot be changed after the batch is minted.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="batch-lot">Lot number</Label>
              <Input
                id="batch-lot"
                value={factsDraft.lot}
                onChange={(e) => setFact("lot", e.target.value)}
                placeholder="e.g., L2406A"
                maxLength={FACT_LIMITS.lot}
                disabled={!canCreate}
                aria-invalid={factsRead.errors.lot ? true : undefined}
              />
              {factsRead.errors.lot && (
                <p className="text-xs text-destructive">{factsRead.errors.lot}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="batch-made-on">Made on</Label>
              <Input
                id="batch-made-on"
                type="date"
                className="dark:[color-scheme:dark]"
                value={factsDraft.madeOn}
                onChange={(e) => setFact("madeOn", e.target.value)}
                disabled={!canCreate}
                aria-invalid={factsRead.errors.madeOn ? true : undefined}
              />
              {factsRead.errors.madeOn && (
                <p className="text-xs text-destructive">{factsRead.errors.madeOn}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="batch-best-before">Best before</Label>
              <Input
                id="batch-best-before"
                type="date"
                className="dark:[color-scheme:dark]"
                value={factsDraft.bestBefore}
                onChange={(e) => setFact("bestBefore", e.target.value)}
                disabled={!canCreate}
                aria-invalid={factsRead.errors.bestBefore ? true : undefined}
              />
              {factsRead.errors.bestBefore && (
                <p className="text-xs text-destructive">{factsRead.errors.bestBefore}</p>
              )}
            </div>
          </div>
        </fieldset>
      )}

      <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground space-y-1">
        <p>
          • Max {MAX_BATCH_SIZE} rows per batch — the whole batch mints as ONE on-chain batchMint
          transaction; split larger runs into several batches.
        </p>
        <p>
          • CSV columns: <span className="font-mono">serial</span> (required, unique),{" "}
          <span className="font-mono">tag_uid</span>,{" "}
          <span className="font-mono">name_override</span>,{" "}
          <span className="font-mono">price_usdc</span>. Strict RFC 4180 — quoted fields,{" "}
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
