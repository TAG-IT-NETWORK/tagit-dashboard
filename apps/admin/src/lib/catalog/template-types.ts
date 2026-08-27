/**
 * Types for the /catalog template surface (META-T33).
 *
 * Shapes mirror tagit-services src/catalog/{template-router,templates}.ts
 * (serializeTemplate + the router response envelopes) — READ from the
 * services source, not invented. priceUsdc6 is serialized as a decimal
 * string of usdc-6 minor units (bigint column); timestamps arrive as ISO
 * strings after JSON.
 */

export type TemplateStatus = "draft" | "published" | "archived";

export interface TemplateAttribute {
  trait_type: string;
  value: string;
}

/** serializeTemplate(row) — the working copy. */
export interface TemplateDto {
  id: string;
  slug: string;
  status: TemplateStatus;
  /** Latest PUBLISHED snapshot version (0 = never published). */
  version: number;
  name: string;
  brand: string | null;
  model: string | null;
  sku: string | null;
  category: string | null;
  origin: string | null;
  description: string | null;
  attributes: TemplateAttribute[] | null;
  /** usdc-6 minor units as a decimal string, e.g. "22500000". */
  priceUsdc6: string | null;
  msrpAmount: number | null;
  msrpCurrency: string | null;
  businessId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  /**
   * catalog_items count for this template (WB-05) — attached by the services
   * list/detail routes via serializeTemplate extras; absent on write-path
   * responses.
   */
  itemsCount?: number;
}

/**
 * template_versions rows from GET /api/v1/admin/templates/:id — snapshot is
 * the BARE working-copy object buildTemplateSnapshot() returns (services
 * src/catalog/template-snapshot.ts).
 */
export interface TemplateVersionDto {
  version: number;
  snapshot: Record<string, unknown>;
  publishedBy: string;
  publishedAt: string;
}

export interface TemplateDetailResponse {
  ok: boolean;
  template: TemplateDto;
  versions: TemplateVersionDto[];
  error?: string;
}

export interface TemplateListResponse {
  ok: boolean;
  count: number;
  templates: TemplateDto[];
  error?: string;
}

export interface TemplateUpdateResponse {
  ok: boolean;
  /** True when the edit auto-forked a PUBLISHED template's working copy. */
  forked: boolean;
  template: TemplateDto;
  error?: string;
}

export interface TemplatePublishResponse {
  ok: boolean;
  version: number;
  snapshot: Record<string, unknown>;
  template: TemplateDto;
  error?: string;
}

/** 202 from POST /api/v1/admin/templates/:id/propagate. */
export interface PropagateStartResponse {
  ok: boolean;
  jobId: string;
  targetVersion: number;
  error?: string;
}

/** serializePropagateJob(row) — cursor is stringified bigint. */
export interface PropagateJobDto {
  id: string;
  templateId: string;
  targetVersion: number;
  tokenIds: string[] | null;
  state: string;
  cursor: string | null;
  processed: number;
  updatedCount: number;
  unchangedCount: number;
  skippedCount: number;
  actor: string;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * One row of the editor's Items table (WB-05): the services template-items
 * enumeration (GET /api/v1/admin/templates/:id/items — same row shape as
 * GET /api/v1/admin/catalog, services admin-list.ts CatalogListItem). Rows
 * carry REAL template linkage (adopted templateVersion) — the old public
 * per-token fan-out is gone.
 */
export interface TemplateItemRow {
  tokenId: string;
  name: string | null;
  /** tagit.serial from the latest metadata doc. */
  serial: string | null;
  /** catalog_items.lifecycle (draft | minted | bound | anchored | recycled). */
  lifecycle: string | null;
  /** Snapshot version the item was adopted/rendered from. */
  templateVersion: number | null;
  bound: boolean;
  restricted: boolean;
  anchoredVersion: number | null;
  latestVersion: number | null;
  anchorStatus: string | null;
  /** Metadata-anchor drift flag (server-computed; verdict re-derived in UI). */
  drift: boolean;
  needsProductInfo: boolean;
}

/** GET /api/v1/admin/templates/:id/items envelope (via the items proxy). */
export interface TemplateItemsResponse {
  ok: boolean;
  templateId?: string;
  count?: number;
  items?: unknown[];
  nextCursor?: string | null;
  error?: string;
  message?: string;
}
