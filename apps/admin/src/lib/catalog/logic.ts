/**
 * Pure catalog-registry logic (META-T36) — no fetch, no React, fully
 * unit-tested. Everything here runs identically on the server (page render,
 * proxy validation) and in the browser (slide-over).
 */

import type {
  AnchorVerdict,
  CatalogLifecycle,
  IntegrityResult,
  ProductBlock,
  RegistryFilters,
  RegistryRow,
  VerificationBlock,
} from "./types";
import { CATALOG_LIFECYCLES, CHAIN_STATE_FILTERS, type ChainStateFilter } from "./types";

// ──────────────────────────────────────────────
// Anchor verdict (REQ-S-12 tri-state) + drift dot
// ──────────────────────────────────────────────

const ZERO_HASH = `0x${"0".repeat(64)}`;

/**
 * Tri-state anchor verdict for an item's verification block:
 *
 *   drift     — anchor_status='drift': the reconciler found the on-chain
 *               metadataHash disagreeing with the anchored doc (primary AND
 *               witness RPC). The only red.
 *   confirmed — the anchored version IS the latest version.
 *   pending   — everything else: first publish awaiting its anchor
 *               (anchoredVersion null), anchor_status pending/submitted, a
 *               NEWER version above the anchored one (re-anchor in flight —
 *               see isReanchorPending; this used to be reported as drift and
 *               painted every routine republish red until the next sweep),
 *               or an item with no verification data at all (yellow, never
 *               green).
 */
export function anchorVerdict(v: Partial<VerificationBlock> | null | undefined): AnchorVerdict {
  if (!v) return "pending";
  if (v.anchorStatus === "drift") return "drift";
  if (isReanchorPending(v)) return "pending";
  if (v.anchorStatus === "confirmed") return "confirmed";
  return "pending";
}

/** A newer metadata version exists above the last anchored one (anchor in flight). */
export function isReanchorPending(v: Partial<VerificationBlock> | null | undefined): boolean {
  return (
    !!v &&
    typeof v.latestVersion === "number" &&
    typeof v.anchoredVersion === "number" &&
    v.latestVersion > v.anchoredVersion
  );
}

/** Drift dot predicate — the reconciler's verdict only. */
export function hasDrift(v: Partial<VerificationBlock> | null | undefined): boolean {
  return anchorVerdict(v) === "drift";
}

// ──────────────────────────────────────────────
// Integrity check: on-chain metadataHash vs served jcs_hash
// ──────────────────────────────────────────────

const HASH_RE = /^0x[0-9a-fA-F]{64}$/;

/**
 * Compare the on-chain TAGITCore.metadataHash(tokenId) read against the
 * jcs_hash served by the catalog API. Case-insensitive; the zero hash means
 * "never anchored on-chain" and either side missing/malformed is unknown —
 * only two well-formed, non-zero hashes can produce match/mismatch.
 */
export function compareIntegrity(
  onChainHash: string | null | undefined,
  servedHash: string | null | undefined,
  latestHash?: string | null,
): IntegrityResult {
  if (!onChainHash || !servedHash) return "unknown";
  const chain = onChainHash.toLowerCase();
  const served = servedHash.toLowerCase();
  if (!HASH_RE.test(chain) || !HASH_RE.test(served)) return "unknown";
  if (chain === ZERO_HASH || served === ZERO_HASH) return "unknown";
  if (chain === served) return "match";
  // The chain already carries the NEWEST version while the DB still serves
  // the last confirmed one: a re-anchor whose confirmation is pending, not a
  // mismatch (live 2026-09-05: token 55 v3 landed seconds before its row
  // was confirmed).
  const latest = latestHash?.toLowerCase();
  if (latest && HASH_RE.test(latest) && chain === latest) return "confirming";
  return "mismatch";
}

// ──────────────────────────────────────────────
// Overrides editor validation (client-side mirror; server re-enforces)
// ──────────────────────────────────────────────

/**
 * Identity-bearing tagit fields the services publish rail rejects after first
 * publish (mirror of tagit-services IMMUTABLE_TAGIT_FIELDS — client-side
 * fast-feedback only; the server remains the enforcement point).
 */
export const IMMUTABLE_TAGIT_FIELDS = [
  "tokenId",
  "chainId",
  "contract",
  "tagHash",
  "serial",
  "gtin",
] as const;

export type OverridesValidation =
  | { ok: true; doc: Record<string, unknown> }
  | { ok: false; error: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Parse + validate the overrides editor's JSON text. Must be a JSON object
 * (the publish doc overlay); immutable tagit identity fields are rejected
 * up-front so the user gets instant feedback instead of a 409.
 */
export function validateOverridesDoc(text: string): OverridesValidation {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (!isPlainObject(parsed)) {
    return { ok: false, error: "Overrides must be a JSON object (not an array or scalar)" };
  }
  const tagit = parsed["tagit"];
  if (tagit !== undefined) {
    if (!isPlainObject(tagit)) {
      return { ok: false, error: "'tagit' must be a JSON object" };
    }
    for (const field of IMMUTABLE_TAGIT_FIELDS) {
      if (tagit[field] !== undefined) {
        return {
          ok: false,
          error: `'tagit.${field}' is immutable after first publish and cannot be overridden`,
        };
      }
    }
  }
  return { ok: true, doc: parsed };
}

// ──────────────────────────────────────────────
// Admin catalog list item → registry row mapping (WB-04)
// ──────────────────────────────────────────────

function readString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function readProduct(value: unknown): ProductBlock | null {
  if (!isPlainObject(value)) return null;
  const product: ProductBlock = {};
  for (const key of ["name", "brand", "model", "sku", "origin", "category"] as const) {
    const v = readString(value[key]);
    if (v) product[key] = v;
  }
  return product;
}

/**
 * Map one GET /api/v1/admin/catalog item (services admin-list.ts
 * CatalogListItem, JSON-serialized) onto a registry row. Tolerant of missing
 * fields — a malformed entry degrades to a minimal pending row rather than
 * throwing mid-page. The anchor verdict is recomputed CLIENT-SIDE from the
 * verification numbers via {@link anchorVerdict} (the drift logic is kept
 * here, not blindly trusted from the wire), which matches the server's
 * definition: anchor_status='drift' OR latestVersion > anchoredVersion.
 */
export function registryRowFromAdminItem(item: unknown): RegistryRow {
  const raw = isPlainObject(item) ? item : {};
  const tokenId =
    typeof raw.tokenId === "string"
      ? raw.tokenId
      : typeof raw.tokenId === "number"
        ? String(raw.tokenId)
        : "";
  const num = (v: unknown): number | null => (typeof v === "number" ? v : null);
  const verification: VerificationBlock = {
    anchoredVersion: num(raw.anchoredVersion),
    latestVersion: num(raw.latestVersion),
    anchorStatus: readString(raw.anchorStatus),
    // On-chain hash comparison stays a slide-over concern (integrity check).
    metadataHash: null,
    verified: false,
  };
  const saleState = raw.saleState;

  return {
    tokenId,
    restricted: raw.visibility === "restricted",
    name: readString(raw.name),
    templateId: readString(raw.templateId),
    templateVersion: num(raw.templateVersion),
    serial: readString(raw.serial),
    lifecycle: readString(raw.lifecycle),
    chainState: readString(raw.chainState),
    bound: raw.bound === true,
    priceDisplay: readString(raw.priceDisplay),
    saleState:
      saleState === "listed" || saleState === "sold" || saleState === "not_for_sale"
        ? saleState
        : null,
    verification,
    verdict: anchorVerdict(verification),
    hasProductInfo: raw.needsProductInfo !== true,
  };
}

/** needs-product-info: no metadata version exists yet (admin list flag). */
export function needsProductInfo(row: Pick<RegistryRow, "hasProductInfo">): boolean {
  return !row.hasProductInfo;
}

// ──────────────────────────────────────────────
// URL-search-param filters (server-rendered)
// ──────────────────────────────────────────────

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Parse ?lifecycle=bound&needsInfo=1&drift=1 into typed filters. Bad input →
 * no filter. (WB-04: filters are catalog lifecycles now — the admin list
 * speaks catalog_items.lifecycle, not the chain state enum.)
 */
export function parseRegistryFilters(searchParams: SearchParams): RegistryFilters {
  const rawLifecycle = firstParam(searchParams.lifecycle);
  const lifecycle = (CATALOG_LIFECYCLES as readonly string[]).includes(rawLifecycle ?? "")
    ? (rawLifecycle as CatalogLifecycle)
    : null;
  const rawState = firstParam(searchParams.state);
  const state = (CHAIN_STATE_FILTERS as readonly string[]).includes(rawState ?? "")
    ? (rawState as ChainStateFilter)
    : null;
  return {
    lifecycle,
    needsInfo: firstParam(searchParams.needsInfo) === "1",
    drift: firstParam(searchParams.drift) === "1",
    state,
  };
}

/**
 * Apply the registry filters (AND semantics) to the mapped rows. The server
 * already filters the page (lifecycle/drift/needsProductInfo query params) —
 * this re-filter is the client-side correctness authority for whatever the
 * wire returned (defense in depth, same stance as the services JS re-filter).
 */
export function applyRegistryFilters(rows: RegistryRow[], filters: RegistryFilters): RegistryRow[] {
  return rows.filter((row) => {
    if (filters.lifecycle !== null && row.lifecycle !== filters.lifecycle) return false;
    if (filters.needsInfo && !needsProductInfo(row)) return false;
    if (filters.drift && row.verdict !== "drift") return false;
    if (filters.state !== null && row.chainState !== filters.state) return false;
    return true;
  });
}

/**
 * Build an /assets href for the given filters (+ optional keyset cursor),
 * omitting defaults. Filter toggles intentionally DROP the cursor — changing
 * the filter restarts pagination from the first page.
 */
export function registryHref(filters: RegistryFilters, cursor?: string | null): string {
  const params = new URLSearchParams();
  if (filters.lifecycle !== null) params.set("lifecycle", filters.lifecycle);
  if (filters.needsInfo) params.set("needsInfo", "1");
  if (filters.drift) params.set("drift", "1");
  if (filters.state !== null) params.set("state", filters.state);
  if (cursor !== undefined && cursor !== null && /^\d+$/.test(cursor)) {
    params.set("cursor", cursor);
  }
  const qs = params.toString();
  return qs ? `/assets?${qs}` : "/assets";
}
