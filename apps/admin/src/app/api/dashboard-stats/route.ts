import { NextResponse } from "next/server";

import { getActorRole } from "@/lib/actor-role";
import { fetchAdminCatalogRaw, fetchRecentBatchesRaw } from "@/lib/catalog/server";
import { aggregateCatalog, parseRecentBatches, type DashboardStatsDto } from "@/lib/dashboard/stats";

/**
 * GET /api/dashboard-stats — real dashboard numbers from the services
 * catalog (org-wide admin list + recent batches), computed server-side so
 * SERVICES_API_KEY never reaches the browser. Any signed-in role may read it
 * (the same data the /assets registry already shows viewers).
 *
 * Walks the keyset-paginated admin list up to PAGE_CAP pages; `truncated`
 * tells the UI when the counts are a lower bound.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_LIMIT = 100;
const PAGE_CAP = 10;

export async function GET() {
  if ((await getActorRole()) === null) {
    return NextResponse.json({ ok: false, error: "not signed in" }, { status: 401 });
  }

  const items: unknown[] = [];
  const warnings: string[] = [];
  let cursor: string | undefined;
  let truncated = false;
  for (let page = 0; page < PAGE_CAP; page++) {
    const res = await fetchAdminCatalogRaw(PAGE_LIMIT, cursor);
    if (res.error) {
      if (page === 0) return NextResponse.json({ ok: false, error: res.error }, { status: 502 });
      warnings.push(`catalog walk stopped early: ${res.error}`);
      truncated = true;
      break;
    }
    items.push(...res.items);
    if (!res.nextCursor) break;
    cursor = res.nextCursor;
    if (page === PAGE_CAP - 1) truncated = true;
  }

  const batchesBody = await fetchRecentBatchesRaw(10);
  if (batchesBody === null) warnings.push("batch list unavailable");

  const body: DashboardStatsDto = {
    ok: true,
    generatedAt: new Date().toISOString(),
    catalog: aggregateCatalog(items, new Date(), { recentLimit: 8, truncated }),
    batches: parseRecentBatches(batchesBody, 5),
    warnings,
  };
  return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
}
