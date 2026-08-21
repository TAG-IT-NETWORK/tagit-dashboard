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
 * One row of the editor's Items table. Assembled by the items proxy from the
 * public per-token detail DTO (GET /api/v1/assets/:tokenId) — tagit-services
 * main ships NO template→items enumeration endpoint (see items proxy notes),
 * so rows are resolved from an explicit token-id set and the public DTO,
 * which does not expose per-item template linkage.
 */
export interface TemplateItemRow {
  tokenId: string;
  found: boolean;
  restricted: boolean;
  name: string | null;
  image: string | null;
  lifecycleState: string | null;
  sku: string | null;
  anchoredVersion: number | null;
  latestVersion: number | null;
  anchorStatus: string | null;
}

export interface TemplateItemsResponse {
  ok: boolean;
  rows: TemplateItemRow[];
  error?: string;
}
