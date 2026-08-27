/**
 * Types for the /assets catalog registry (META-T36; WB-04).
 *
 * The registry rows come from the tagit-services ADMIN catalog list
 * (GET /api/v1/admin/catalog — src/catalog/admin-list.ts CatalogListItem):
 * keyset-paginated by token id, tenant-scoped, and INCLUSIVE of restricted,
 * unanchored and drifted items — the old public-enumeration fan-out
 * (GET /api/v1/assets/public + per-token DTOs) only ever saw
 * public+confirmed rows. The per-token detail DTO
 * (GET /api/v1/assets/:tokenId) still backs the slide-over.
 *
 * Shapes below mirror the services source — fields the admin console does
 * not render are omitted; unknown extra fields are ignored by the mappers.
 */

/** catalog_items.lifecycle values (services itemLifecycleEnum). */
export const CATALOG_LIFECYCLES = [
  "draft",
  "minted",
  "bound",
  "anchored",
  "recycled",
] as const;
export type CatalogLifecycle = (typeof CATALOG_LIFECYCLES)[number];

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

/** One row of the org-wide registry table (admin catalog list item). */
export interface RegistryRow {
  tokenId: string;
  /** visibility === 'restricted' — admin sees the data, badge marks it. */
  restricted: boolean;
  name: string | null;
  /** Template linkage — real values from the admin list (WB-04). */
  templateId: string | null;
  templateVersion: number | null;
  /** tagit.serial from the latest metadata doc. */
  serial: string | null;
  /** catalog_items.lifecycle (draft | minted | bound | anchored | recycled). */
  lifecycle: string | null;
  /** tag_hash present — the physical tag is bound. */
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
  /** catalog_items.lifecycle filter, or null = all. */
  lifecycle: CatalogLifecycle | null;
  /** Only items missing product metadata. */
  needsInfo: boolean;
  /** Only items whose anchor verdict is drift. */
  drift: boolean;
}
