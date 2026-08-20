/**
 * Pure catalog-registry logic (META-T36) — no fetch, no React, fully
 * unit-tested. Everything here runs identically on the server (page render,
 * proxy validation) and in the browser (slide-over).
 */

import type {
  AnchorVerdict,
  IntegrityResult,
  PriceBlock,
  ProductBlock,
  RegistryFilters,
  RegistryRow,
  VerificationBlock,
} from "./types";

// ──────────────────────────────────────────────
// Anchor verdict (REQ-S-12 tri-state) + drift dot
// ──────────────────────────────────────────────

const ZERO_HASH = `0x${"0".repeat(64)}`;

/**
 * Tri-state anchor verdict for an item's verification block:
 *
 *   drift     — anchor_status='drift' (reconciler detected the on-chain hash
 *               no longer matches), OR a newer metadata version supersedes the
 *               anchored one (latestVersion > anchoredVersion).
 *   confirmed — the anchored version IS the latest version.
 *   pending   — everything else: first publish awaiting its anchor
 *               (anchoredVersion null), anchor_status pending/submitted, or an
 *               item with no verification data at all (yellow, never green).
 */
export function anchorVerdict(v: Partial<VerificationBlock> | null | undefined): AnchorVerdict {
  if (!v) return "pending";
  if (v.anchorStatus === "drift") return "drift";
  if (
    typeof v.latestVersion === "number" &&
    typeof v.anchoredVersion === "number" &&
    v.latestVersion > v.anchoredVersion
  ) {
    return "drift";
  }
  if (v.anchorStatus === "confirmed") return "confirmed";
  return "pending";
}

/** Drift dot predicate (acceptance: latestVersion>anchoredVersion or anchor_status='drift'). */
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
): IntegrityResult {
  if (!onChainHash || !servedHash) return "unknown";
  const chain = onChainHash.toLowerCase();
  const served = servedHash.toLowerCase();
  if (!HASH_RE.test(chain) || !HASH_RE.test(served)) return "unknown";
  if (chain === ZERO_HASH || served === ZERO_HASH) return "unknown";
  return chain === served ? "match" : "mismatch";
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
// Detail DTO → registry row mapping
// ──────────────────────────────────────────────

function readString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readVerification(value: unknown): VerificationBlock | null {
  if (!isPlainObject(value)) return null;
  const num = (v: unknown): number | null => (typeof v === "number" ? v : null);
  return {
    anchoredVersion: num(value.anchoredVersion),
    latestVersion: num(value.latestVersion),
    anchorStatus: readString(value.anchorStatus),
    metadataHash: readString(value.metadataHash),
    verified: value.verified === true,
  };
}

function readPrice(value: unknown): PriceBlock | null {
  if (!isPlainObject(value)) return null;
  const saleState = value.saleState;
  return {
    priceUsdc6: readString(value.priceUsdc6),
    display: readString(value.display),
    saleState:
      saleState === "listed" || saleState === "sold" ? saleState : "not_for_sale",
  };
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
 * Map one services asset-detail JSON body (or restricted stub) into a
 * registry row. Tolerant of missing blocks — the DTO's additive blocks only
 * exist for migrated/anchored items.
 */
export function buildRegistryRow(tokenId: string, body: unknown): RegistryRow {
  const detail = isPlainObject(body) ? body : {};
  const restricted = detail.restricted === true;
  const verification = readVerification(detail.verification);
  const price = readPrice(detail.price);
  const product = readProduct(detail.product);
  const name = readString(detail.name) ?? product?.name ?? null;
  const tagHash = readString(detail.tagHash);
  const hasProductInfo = Boolean(product && (product.name || product.brand || product.sku));

  return {
    tokenId,
    restricted,
    // The restricted stub's placeholder name/image are intentionally not
    // rendered as product data.
    name: restricted ? null : name,
    image: restricted ? null : readString(detail.image),
    stateCode: typeof detail.stateCode === "number" ? detail.stateCode : null,
    lifecycleState: readString(detail.lifecycleState),
    bound: Boolean(tagHash && tagHash.toLowerCase() !== ZERO_HASH),
    priceDisplay: price?.display ?? null,
    saleState: price?.saleState ?? null,
    verification,
    verdict: restricted ? "pending" : anchorVerdict(verification),
    hasProductInfo,
  };
}

/** needs-product-info: knowable only for unrestricted rows. */
export function needsProductInfo(row: Pick<RegistryRow, "restricted" | "hasProductInfo">): boolean {
  return !row.restricted && !row.hasProductInfo;
}

// ──────────────────────────────────────────────
// URL-search-param filters (server-rendered)
// ──────────────────────────────────────────────

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Parse ?state=N&needsInfo=1&drift=1 into typed filters. Bad input → no filter. */
export function parseRegistryFilters(searchParams: SearchParams): RegistryFilters {
  const rawState = firstParam(searchParams.state);
  const state =
    rawState !== undefined && /^[0-6]$/.test(rawState) ? Number.parseInt(rawState, 10) : null;
  return {
    state,
    needsInfo: firstParam(searchParams.needsInfo) === "1",
    drift: firstParam(searchParams.drift) === "1",
  };
}

/** Apply the registry filters (AND semantics) to the mapped rows. */
export function applyRegistryFilters(rows: RegistryRow[], filters: RegistryFilters): RegistryRow[] {
  return rows.filter((row) => {
    if (filters.state !== null && row.stateCode !== filters.state) return false;
    if (filters.needsInfo && !needsProductInfo(row)) return false;
    if (filters.drift && row.verdict !== "drift") return false;
    return true;
  });
}

/** Build an /assets href for the given filters, omitting defaults. */
export function registryHref(filters: RegistryFilters): string {
  const params = new URLSearchParams();
  if (filters.state !== null) params.set("state", String(filters.state));
  if (filters.needsInfo) params.set("needsInfo", "1");
  if (filters.drift) params.set("drift", "1");
  const qs = params.toString();
  return qs ? `/assets?${qs}` : "/assets";
}
