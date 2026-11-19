/**
 * Types for the /catalog/:id/batch wizard (META-T34).
 *
 * Shapes mirror tagit-services src/catalog/{batch,batch-router}.ts
 * (serializeBatch + the router response envelopes) — READ from the services
 * source, not invented. Token bounds are bigint columns serialized as decimal
 * strings; timestamps arrive as ISO strings after JSON.
 */

import type { BatchFacts } from "./product-facts";

/** batches.state — see services batch.ts state machine. */
export type BatchState = "validated" | "minting" | "minted" | "mint_failed";

/** serializeBatch(row) — csvSource is stripped upstream (internal). */
export interface BatchDto {
  id: string;
  templateId: string;
  size: number;
  state: BatchState | string;
  /** batchMint broadcast hash (persisted pre-receipt) — null until broadcast. */
  txHash: string | null;
  /** Decimal token-id strings; null until state='minted'. */
  tokenStart: string | null;
  tokenEnd: string | null;
  actor: string;
  /** Lot, made-on and best-before shared by every item (TAP-T09); null when unset. */
  facts?: BatchFacts | null;
  createdAt: string;
  updatedAt: string;
}

/** One validated CSV data row (create response; priceUsdc6 restringified). */
export interface BatchCsvRowDto {
  serial: string;
  tagUid?: string;
  nameOverride?: string;
  priceUsdc6?: string;
}

/** Row-level soft error, 1-based data-row index (services CsvValidation). */
export interface BatchRowError {
  row: number;
  error: string;
}

/**
 * POST /api/v1/admin/batches — 201 on success; 400 carries {rows, errors}
 * as the validation preview WITHOUT persisting anything.
 */
export interface BatchCreateResponse {
  ok: boolean;
  batch?: BatchDto;
  rows?: BatchCsvRowDto[];
  errors?: BatchRowError[];
  /** AppError envelope fields (structural CSV rejects come back this way). */
  error?: string;
  message?: string;
}

/** POST :id/execute — 202 while minting, 200 once already minted. */
export interface BatchExecuteResponse {
  ok: boolean;
  batchId?: string;
  status?: string;
  statusUrl?: string;
  error?: string;
  message?: string;
}

/** POST :id/unstick — resolves a stuck 'minting' batch from the chain. */
export interface BatchUnstickResponse {
  ok: boolean;
  batchId?: string;
  status?: string;
  action?:
    | "in_flight"
    | "finalized_from_receipt"
    | "reverted_reset"
    | "tx_unconfirmed_reset"
    | "no_broadcast_reset";
  statusUrl?: string;
  error?: string;
  message?: string;
}

/** Per-token progress row (getBatchStatus → progress.tokens[]). */
export interface BatchTokenRow {
  tokenId: string;
  lifecycle: string;
  tagUid: string | null;
  serial: string | null;
  /**
   * The item's state on the registry as the catalog last mirrored it, or
   * null. ABSENT on a services build older than TAP-T19.
   */
  chainState?: string | null;
}

export interface BatchProgress {
  expected: number;
  minted: number;
  tokens: BatchTokenRow[];
}

/**
 * Why a batch is in `mint_failed` (TAP-T19): a code from a fixed list and a
 * sentence the services side wrote for it. The sentence is safe to show as it
 * is; it never carries text from the underlying error.
 */
export interface BatchFailure {
  code: string;
  message: string;
  /** When the failed attempt ended (ISO), or null. */
  at: string | null;
}

/** GET /api/v1/admin/batches/:id. */
export interface BatchStatusResponse {
  ok: boolean;
  batch?: BatchDto;
  progress?: BatchProgress;
  /**
   * Null unless the batch is in `mint_failed` and its reason was recorded.
   * ABSENT on a services build older than TAP-T19.
   */
  failure?: BatchFailure | null;
  error?: string;
  message?: string;
}
