/**
 * Types for the /assets catalog registry (META-T36).
 *
 * The registry is built from the tagit-services catalog surface:
 *   GET /api/v1/assets/public       → org-wide enumeration (tokenId list)
 *   GET /api/v1/assets/:tokenId     → per-token detail DTO (verification,
 *                                     product, price, media blocks)
 *
 * The detail DTO shapes below mirror tagit-services src/api/assets.ts
 * (buildAssetDetail). Fields the admin console does not render are omitted —
 * unknown extra fields are simply ignored by the mappers.
 */

/** Verification block of the services detail DTO (trust-rule fields). */
export interface VerificationBlock {
  anchoredVersion: number | null;
  latestVersion: number | null;
  anchorStatus: string | null;
  metadataHash: string | null;
  verified: boolean;
}

/** Price block (canonical price from the pricing service). */
export interface PriceBlock {
  priceUsdc6: string | null;
  display: string | null;
  saleState: "not_for_sale" | "listed" | "sold";
}

/** Product block (subset of the anchored doc's tagit fields). */
export interface ProductBlock {
  name?: string;
  brand?: string;
  model?: string;
  sku?: string;
  origin?: string;
  category?: string;
}

/** REQ-S-12 tri-state anchor verdict. */
export type AnchorVerdict = "confirmed" | "pending" | "drift";

/** Result of comparing the on-chain metadataHash against the served jcs_hash. */
export type IntegrityResult = "match" | "mismatch" | "unknown";

/** One row of the org-wide registry table. */
export interface RegistryRow {
  tokenId: string;
  /** Item is visibility-restricted — the public DTO serves a protected stub. */
  restricted: boolean;
  name: string | null;
  image: string | null;
  /** Numeric lifecycle state code (chain enum; null when restricted). */
  stateCode: number | null;
  lifecycleState: string | null;
  /** A non-zero tagHash is bound. */
  bound: boolean;
  priceDisplay: string | null;
  saleState: PriceBlock["saleState"] | null;
  verification: VerificationBlock | null;
  verdict: AnchorVerdict;
  /** False when the item has no product metadata (needs-product-info filter). */
  hasProductInfo: boolean;
}

/** URL-search-param driven registry filters (server-rendered). */
export interface RegistryFilters {
  /** Lifecycle state code filter (chain enum 0–6), or null = all. */
  state: number | null;
  /** Only items missing product metadata. */
  needsInfo: boolean;
  /** Only items whose anchor verdict is drift. */
  drift: boolean;
}
