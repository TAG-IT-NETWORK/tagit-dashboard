/**
 * Dashboard statistics from the CATALOG (pure — unit-tested, client-safe).
 *
 * The admin has no indexer on Base Sepolia (NEXT_PUBLIC_SUBGRAPH_URL unset),
 * so until one exists every dashboard number was a hard-coded placeholder
 * ("23 daily mints", "145 active users", +12 % deltas, fake token ids). The
 * services catalog is the real operational truth we do have: every minted
 * item with its lifecycle, tag, anchor and listing state. This module folds
 * the org-wide admin list (GET /api/v1/admin/catalog) into the numbers the
 * dashboard shows and says "not indexed" for anything it cannot know.
 */

export const CATALOG_LIFECYCLES = ["draft", "minted", "bound", "anchored", "recycled"] as const;
export type CatalogLifecycle = (typeof CATALOG_LIFECYCLES)[number];

export interface RecentCatalogItem {
  tokenId: string;
  name: string | null;
  lifecycle: string;
  bound: boolean;
  saleState: string | null;
  anchorStatus: string | null;
  /** ISO timestamp of the last catalog change. */
  updatedAt: string;
}

export interface CatalogStats {
  totalItems: number;
  byLifecycle: Record<CatalogLifecycle, number>;
  boundCount: number;
  listedCount: number;
  soldCount: number;
  driftCount: number;
  reanchorPendingCount: number;
  needsProductInfoCount: number;
  /** Mirrored on-chain FLAGGED rows (chain_state). */
  flaggedCount: number;
  /** Mirrored on-chain CLAIMED rows (chain_state). */
  claimedCount: number;
  /** Items whose catalog row changed in the last 24 h (mint, bind, anchor, listing…). */
  changedLast24h: number;
  /** Newest changes first. */
  recent: RecentCatalogItem[];
  /** True when the walk stopped at the page cap — counts are a lower bound. */
  truncated: boolean;
}

export interface RecentBatch {
  id: string;
  templateId: string | null;
  size: number;
  state: string;
  createdAt: string;
}

/** Wire shape of GET /api/dashboard-stats. */
export interface DashboardStatsDto {
  ok: true;
  generatedAt: string;
  catalog: CatalogStats;
  batches: RecentBatch[];
  /** Non-fatal problems (e.g. batch list unavailable) — the rest is still real. */
  warnings: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function str(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

/** Fold raw admin-list items (services CatalogListItem JSON) into stats. */
export function aggregateCatalog(
  items: unknown[],
  now: Date,
  options: { recentLimit?: number; truncated?: boolean } = {},
): CatalogStats {
  const recentLimit = options.recentLimit ?? 8;
  const byLifecycle: Record<CatalogLifecycle, number> = {
    draft: 0,
    minted: 0,
    bound: 0,
    anchored: 0,
    recycled: 0,
  };
  const stats: CatalogStats = {
    totalItems: 0,
    byLifecycle,
    boundCount: 0,
    listedCount: 0,
    soldCount: 0,
    driftCount: 0,
    reanchorPendingCount: 0,
    needsProductInfoCount: 0,
    flaggedCount: 0,
    claimedCount: 0,
    changedLast24h: 0,
    recent: [],
    truncated: options.truncated === true,
  };
  const cutoff = now.getTime() - DAY_MS;
  const recent: RecentCatalogItem[] = [];

  for (const raw of items) {
    if (typeof raw !== "object" || raw === null) continue;
    const it = raw as Record<string, unknown>;
    const tokenId = str(it.tokenId);
    if (tokenId === null) continue;
    stats.totalItems++;
    const lifecycle = str(it.lifecycle) ?? "";
    if ((CATALOG_LIFECYCLES as readonly string[]).includes(lifecycle)) {
      byLifecycle[lifecycle as CatalogLifecycle]++;
    }
    if (it.bound === true) stats.boundCount++;
    const saleState = str(it.saleState);
    if (saleState === "listed") stats.listedCount++;
    if (saleState === "sold") stats.soldCount++;
    if (it.drift === true) stats.driftCount++;
    if (it.reanchorPending === true) stats.reanchorPendingCount++;
    if (it.needsProductInfo === true) stats.needsProductInfoCount++;
    const chainState = str(it.chainState);
    if (chainState === "FLAGGED") stats.flaggedCount++;
    if (chainState === "CLAIMED") stats.claimedCount++;
    const updatedAt = str(it.updatedAt);
    const updatedMs = updatedAt ? Date.parse(updatedAt) : Number.NaN;
    if (Number.isFinite(updatedMs) && updatedMs >= cutoff) stats.changedLast24h++;
    recent.push({
      tokenId,
      name: str(it.name),
      lifecycle,
      bound: it.bound === true,
      saleState,
      anchorStatus: str(it.anchorStatus),
      updatedAt: updatedAt ?? "",
    });
  }

  recent.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  stats.recent = recent.slice(0, recentLimit);
  return stats;
}

/** Items that need an operator's eyes: flagged, drift, stuck re-anchors, missing product info. */
export function needsAttention(stats: CatalogStats): number {
  return stats.driftCount + stats.reanchorPendingCount + stats.needsProductInfoCount + stats.flaggedCount;
}

export interface DistributionSlice {
  name: string;
  value: number;
  /** Color key understood by the dashboard's pie (0 gray … 5 orange). */
  state: number;
}

/** Pie slices from catalog lifecycles (only non-zero slices, in lifecycle order). */
export function lifecycleDistribution(stats: CatalogStats): DistributionSlice[] {
  const slices: DistributionSlice[] = [
    { name: "Draft", value: stats.byLifecycle.draft, state: 0 },
    { name: "Minted", value: stats.byLifecycle.minted, state: 1 },
    { name: "Bound", value: stats.byLifecycle.bound, state: 2 },
    { name: "Anchored", value: stats.byLifecycle.anchored, state: 3 },
    { name: "Recycled", value: stats.byLifecycle.recycled, state: 5 },
  ];
  return slices.filter((s) => s.value > 0);
}

/** Parse the batch-list envelope for the dashboard's "Recent batches" card. */
export function parseRecentBatches(body: unknown, limit = 5): RecentBatch[] {
  const env = body as { ok?: unknown; batches?: unknown } | null;
  if (!env || env.ok !== true || !Array.isArray(env.batches)) return [];
  const out: RecentBatch[] = [];
  for (const raw of env.batches) {
    if (typeof raw !== "object" || raw === null) continue;
    const b = raw as Record<string, unknown>;
    const id = str(b.id);
    const state = str(b.state);
    const size =
      typeof b.quantity === "number" ? b.quantity : typeof b.size === "number" ? b.size : null;
    if (id === null || state === null || size === null) continue;
    out.push({ id, templateId: str(b.templateId), size, state, createdAt: str(b.createdAt) ?? "" });
    if (out.length >= limit) break;
  }
  return out;
}

/** Tolerant parse of the route's JSON (null = not a stats envelope). */
export function parseDashboardStats(body: unknown): DashboardStatsDto | null {
  const env = body as Partial<DashboardStatsDto> | null;
  if (!env || env.ok !== true || typeof env.catalog !== "object" || env.catalog === null) return null;
  return {
    ok: true,
    generatedAt: typeof env.generatedAt === "string" ? env.generatedAt : "",
    catalog: env.catalog as CatalogStats,
    batches: Array.isArray(env.batches) ? (env.batches as RecentBatch[]) : [],
    warnings: Array.isArray(env.warnings) ? (env.warnings as string[]) : [],
  };
}
