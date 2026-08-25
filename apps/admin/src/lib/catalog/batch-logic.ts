/**
 * Pure /catalog/:id/batch wizard logic (META-T34) — no fetch, no React, fully
 * unit-tested. Mirrors tagit-services src/catalog/{batch,batch-router}.ts:
 * the CLIENT-SIDE preview below is advisory UX (instant inline row errors);
 * the services validator remains the enforcement point and the create proxy
 * surfaces its 400 {rows, errors} preview verbatim when they disagree.
 */

import type { CatalogRole } from "./template-logic";
import type { BatchRowError } from "./batch-types";

/** Mirror of tagit-services BATCH_ID_RE (batch-router.ts). */
export const BATCH_ID_RE = /^bat_[0-9A-Za-z]{1,64}$/;

/**
 * Mirror of tagit-services MAX_BATCH_SIZE (batch.ts): one batch = ONE
 * batchMint(recipients[], hashes[]) transaction, capped to stay inside Base's
 * block gas limit and the relayer tx-queue timeout. Larger runs are split
 * into multiple batches.
 */
export const MAX_BATCH_SIZE = 250;

/** Mirror of tagit-services BATCH_CSV_COLUMNS (batch.ts). */
export const BATCH_CSV_COLUMNS = ["serial", "tag_uid", "name_override", "price_usdc"] as const;
export type BatchCsvColumn = (typeof BATCH_CSV_COLUMNS)[number];

/**
 * REQ-S-29 IMPORT denylist (mirror of batch.ts IMPORT_DENYLIST): any cell
 * whose FIRST character is one of these is refused outright — import never
 * "fixes" data, it rejects. Export-side the services CSV quotes every cell
 * and neutralizes formula-leading values instead.
 */
export const IMPORT_DENYLIST = new Set(["=", "+", "-", "@", "\t", "\r"]);

/** UI copy for the REQ-S-29 guard — surfaced verbatim in steps 1 and 3. */
export const FORMULA_GUARD_IMPORT_COPY =
  "Spreadsheet formula guard (REQ-S-29): any cell starting with = + - @ TAB or CR is " +
  "rejected on import — fix the source data; the importer never rewrites cells.";
export const FORMULA_GUARD_EXPORT_COPY =
  "Spreadsheet formula guard (REQ-S-29): every exported cell is quoted and " +
  "formula-leading values are neutralized with a leading apostrophe, so the file " +
  "opens inert in Excel/Sheets.";

// ──────────────────────────────────────────────
// Wizard state machine
// ──────────────────────────────────────────────

export const WIZARD_STEPS = ["create", "mint", "export"] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

/**
 * Which wizard step a batch state lands on. This is what makes the wizard
 * RESUMABLE: re-entering the page with a persisted batch id derives the step
 * from the server-side batch state, never from client memory.
 *
 *   (no batch)            → create
 *   validated             → mint   (created, awaiting execute)
 *   minting / mint_failed → mint   (in flight / retryable)
 *   minted                → export
 *   unknown future state  → mint   (status view is the safe landing)
 */
export function wizardStepForBatch(state: string | null | undefined): WizardStep {
  if (state === null || state === undefined) return "create";
  if (state === "minted") return "export";
  return "mint";
}

export function wizardStepIndex(step: WizardStep): number {
  return WIZARD_STEPS.indexOf(step);
}

/** Execute is only legal from these states (services executeBatch guard). */
export function canExecuteBatch(state: string | null | undefined): boolean {
  return state === "validated" || state === "mint_failed";
}

export function isBatchInFlight(state: string | null | undefined): boolean {
  return state === "minting";
}

/**
 * Minting normally settles well inside the services 100s tx-queue timeout;
 * a batch still 'minting' this long after its last update is presumed
 * stranded (crashed continuation) and surfaces the admin Unstick action.
 */
export const STALE_MINTING_MS = 180_000;

/**
 * Unstick gate: ADMIN-ONLY (it flips server state), and only for a batch
 * sitting in 'minting' with no progress for STALE_MINTING_MS. The services
 * side resolves the truth from the chain and broadcasts nothing.
 */
export function canUnstickBatch(
  role: CatalogRole | null,
  state: string | null | undefined,
  msSinceUpdate: number,
): boolean {
  return role === "admin" && state === "minting" && msSinceUpdate >= STALE_MINTING_MS;
}

/** Base Sepolia (84532) is the only live chain — services default chainId. */
export function basescanTxUrl(txHash: string): string {
  return `https://sepolia.basescan.org/tx/${txHash}`;
}

// ──────────────────────────────────────────────
// CSV preview (client-side mirror of services validateBatchCsv)
// ──────────────────────────────────────────────

/** Mirror of services parseUsdcString input shape (see mint-proxy USDC_RE). */
const USDC_INPUT_RE = /^(0|[1-9]\d{0,11})(\.\d{1,6})?$/;

export interface PreviewRow {
  /** 1-based DATA-row index — matches the services {row, error} indices. */
  row: number;
  cells: string[];
  errors: string[];
}

export interface CsvPreview {
  /** True when the CSV would create a batch as-is (no structural/row errors). */
  ok: boolean;
  /** Whole-file reject (parse error, bad header, size cap) — nothing usable. */
  structuralError: string | null;
  header: string[];
  rows: PreviewRow[];
  /** Total row-level errors across all rows. */
  errorCount: number;
}

class CsvParseError extends Error {}

/**
 * Strict RFC 4180 parser — literal port of services parseRfc4180 (batch.ts):
 * comma-separated, CRLF/LF record breaks, quoted fields with "" escapes.
 * Rejects stray quotes, bare CR, unterminated quotes and ragged rows.
 */
export function parseRfc4180(text: string): string[][] {
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  let fieldStarted = false;
  let fieldWasQuoted = false;

  const endField = () => {
    record.push(field);
    field = "";
    fieldStarted = false;
    fieldWasQuoted = false;
  };
  const endRecord = (line: number) => {
    endField();
    if (records.length > 0 && record.length !== records[0].length) {
      throw new CsvParseError(
        `CSV row ${line} has ${record.length} fields, expected ${records[0].length} (ragged row)`,
      );
    }
    records.push(record);
    record = [];
  };

  let line = 1;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      if (ch === "\r" && text[i + 1] !== "\n") {
        throw new CsvParseError(
          `CSV row ${line}: bare CR (\\r without \\n) inside a quoted field`,
        );
      }
      if (ch === "\n") line++;
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      if (fieldWasQuoted || fieldStarted) {
        throw new CsvParseError(
          `CSV row ${line}: unexpected '"' ${fieldWasQuoted ? "after closing quote" : "inside an unquoted field"}`,
        );
      }
      inQuotes = true;
      fieldStarted = true;
      fieldWasQuoted = true;
      i++;
      continue;
    }
    if (ch === ",") {
      endField();
      i++;
      continue;
    }
    if (ch === "\r" && text[i + 1] === "\n") {
      endRecord(line);
      line++;
      i += 2;
      continue;
    }
    if (ch === "\r") {
      throw new CsvParseError(`CSV row ${line}: bare CR (\\r not followed by \\n)`);
    }
    if (ch === "\n") {
      endRecord(line);
      line++;
      i++;
      continue;
    }
    if (fieldWasQuoted) {
      throw new CsvParseError(`CSV row ${line}: unexpected '${ch}' after closing quote`);
    }
    field += ch;
    fieldStarted = true;
    i++;
  }
  if (inQuotes) throw new CsvParseError(`CSV row ${line}: unterminated quoted field`);
  if (fieldStarted || field.length > 0 || record.length > 0) endRecord(line);

  if (records.length === 0) throw new CsvParseError("CSV is empty");
  return records;
}

const EMPTY_PREVIEW: Omit<CsvPreview, "structuralError"> = {
  ok: false,
  header: [],
  rows: [],
  errorCount: 0,
};

/**
 * Build the step-1 validation preview: header checks + per-row soft errors,
 * mirroring services validateBatchCsv row for row (error indices line up with
 * the server's 400 {errors} payload). Formula-denylist violations (REQ-S-29)
 * are attached INLINE on their row here for usable UX — upstream rejects the
 * whole file on the first one, so any violation also forces ok=false.
 *
 * Cell contents are returned VERBATIM (no unescaping, no truncation beyond
 * what the caller renders): hostile strings must reach React as plain data,
 * where JSX text rendering keeps them inert.
 */
export function buildCsvPreview(text: string): CsvPreview {
  let records: string[][];
  try {
    records = parseRfc4180(text);
  } catch (e) {
    return { ...EMPTY_PREVIEW, structuralError: e instanceof Error ? e.message : String(e) };
  }

  const rawHeader = records[0];
  const header = rawHeader.map((h) => h.trim().toLowerCase());

  // Header-row denylist violations are structural (there is no data row to pin them to).
  for (const cell of rawHeader) {
    if (cell.length > 0 && IMPORT_DENYLIST.has(cell[0])) {
      return {
        ...EMPTY_PREVIEW,
        structuralError:
          "header cell starts with a forbidden character (= + - @ TAB CR are rejected on import, REQ-S-29)",
      };
    }
  }
  const allowed = new Set<string>(BATCH_CSV_COLUMNS);
  for (const col of header) {
    if (!allowed.has(col)) {
      return {
        ...EMPTY_PREVIEW,
        header,
        structuralError: `unknown CSV column '${col}' — allowed: ${BATCH_CSV_COLUMNS.join(", ")}`,
      };
    }
  }
  if (new Set(header).size !== header.length) {
    return { ...EMPTY_PREVIEW, header, structuralError: "duplicate CSV column names" };
  }
  if (!header.includes("serial")) {
    return { ...EMPTY_PREVIEW, header, structuralError: "CSV must include a 'serial' column" };
  }

  const dataRecords = records.slice(1);
  if (dataRecords.length === 0) {
    return { ...EMPTY_PREVIEW, header, structuralError: "CSV has a header but no data rows" };
  }
  if (dataRecords.length > MAX_BATCH_SIZE) {
    return {
      ...EMPTY_PREVIEW,
      header,
      structuralError: `CSV has ${dataRecords.length} data rows — max ${MAX_BATCH_SIZE} per batch (split into multiple batches)`,
    };
  }

  const idx = (name: BatchCsvColumn) => header.indexOf(name);
  const seenSerials = new Set<string>();
  const rows: PreviewRow[] = [];
  let errorCount = 0;

  for (let r = 0; r < dataRecords.length; r++) {
    const rec = dataRecords[r];
    const errors: string[] = [];
    const cell = (name: BatchCsvColumn): string | undefined => {
      const i = idx(name);
      if (i === -1) return undefined;
      const v = rec[i].trim();
      return v.length > 0 ? v : undefined;
    };

    // REQ-S-29 inline: pin denylist violations to the row they live on.
    for (let c = 0; c < rec.length; c++) {
      if (rec[c].length > 0 && IMPORT_DENYLIST.has(rec[c][0])) {
        errors.push(
          `'${header[c] ?? `column ${c + 1}`}' starts with a forbidden character (= + - @ TAB CR are rejected on import, REQ-S-29)`,
        );
      }
    }

    const serial = cell("serial");
    if (!serial) {
      errors.push("serial is required");
    } else if (serial.length > 200) {
      errors.push("serial exceeds 200 characters");
    } else if (seenSerials.has(serial)) {
      errors.push(`duplicate serial '${serial}'`);
    } else {
      seenSerials.add(serial);
    }

    const tagUid = cell("tag_uid");
    if (tagUid !== undefined && tagUid.length > 200) {
      errors.push("tag_uid exceeds 200 characters");
    }
    const nameOverride = cell("name_override");
    if (nameOverride !== undefined && nameOverride.length > 200) {
      errors.push("name_override exceeds 200 characters");
    }
    const price = cell("price_usdc");
    if (price !== undefined && !USDC_INPUT_RE.test(price)) {
      errors.push("price_usdc: must be a decimal string with at most 6 decimals");
    }

    errorCount += errors.length;
    rows.push({ row: r + 1, cells: rec, errors });
  }

  return { ok: errorCount === 0, structuralError: null, header, rows, errorCount };
}

/**
 * Merge the services 400 {errors} payload into an existing preview (the
 * server is the enforcement point — anything it flags that the client mirror
 * missed still surfaces inline on the right row). Dedupes identical strings.
 */
export function attachServerErrors(
  preview: CsvPreview,
  serverErrors: BatchRowError[],
): CsvPreview {
  if (serverErrors.length === 0) return preview;
  const byRow = new Map<number, Set<string>>();
  for (const e of serverErrors) {
    const set = byRow.get(e.row) ?? new Set<string>();
    set.add(e.error);
    byRow.set(e.row, set);
  }
  let errorCount = 0;
  const rows = preview.rows.map((row) => {
    const extra = [...(byRow.get(row.row) ?? [])].filter((e) => !row.errors.includes(e));
    const errors = [...row.errors, ...extra];
    errorCount += errors.length;
    return extra.length > 0 ? { ...row, errors } : row;
  });
  return { ...preview, ok: false, rows, errorCount };
}

// ──────────────────────────────────────────────
// Quantity path
// ──────────────────────────────────────────────

/** Mirror of the services quantityCreateSchema bounds (batch-router.ts). */
export function validateQuantity(value: string): { quantity: number | null; error: string | null } {
  if (!/^\d+$/.test(value.trim())) {
    return { quantity: null, error: "quantity must be a whole number" };
  }
  const quantity = Number(value.trim());
  if (quantity < 1 || quantity > MAX_BATCH_SIZE) {
    return { quantity: null, error: `quantity must be 1–${MAX_BATCH_SIZE} (one batchMint tx per batch)` };
  }
  return { quantity, error: null };
}

// ──────────────────────────────────────────────
// Recent-batch memory (cross-session resume)
// ──────────────────────────────────────────────

/**
 * tagit-services ships NO batch-list endpoint (the admin rail is per-id), so
 * "the batch list for this template" is client-side memory: every batch this
 * browser created or opened is remembered per template in localStorage and
 * rendered as resume rows. The URL (?batch=bat_…) remains the canonical
 * cross-machine resume path.
 */
export interface RecentBatch {
  id: string;
  size: number;
  state: string;
  createdAt: string;
}

export const RECENT_BATCH_CAP = 10;

export function recentBatchesKey(templateId: string): string {
  return `tagit.admin.batches.${templateId}`;
}

/** Safe-parse the stored list — malformed/foreign JSON degrades to []. */
export function parseRecentBatches(raw: string | null): RecentBatch[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (b): b is RecentBatch =>
          typeof b === "object" &&
          b !== null &&
          typeof (b as RecentBatch).id === "string" &&
          BATCH_ID_RE.test((b as RecentBatch).id) &&
          typeof (b as RecentBatch).size === "number" &&
          typeof (b as RecentBatch).state === "string" &&
          typeof (b as RecentBatch).createdAt === "string",
      )
      .slice(0, RECENT_BATCH_CAP);
  } catch {
    return [];
  }
}

/** Upsert by id (newest first), capped — pure; the component owns storage IO. */
export function upsertRecentBatch(
  list: RecentBatch[],
  entry: RecentBatch,
  cap: number = RECENT_BATCH_CAP,
): RecentBatch[] {
  return [entry, ...list.filter((b) => b.id !== entry.id)].slice(0, cap);
}
