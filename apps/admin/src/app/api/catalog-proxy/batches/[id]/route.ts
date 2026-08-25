import { NextResponse } from "next/server";

import { BATCH_ID_RE } from "@/lib/catalog/batch-logic";
import { batchesUpstream } from "@/lib/server/batches-upstream";

/**
 * GET /api/catalog-proxy/batches/:id (META-T34/T35) — batch + per-token
 * progress. Pass-through to GET /api/v1/admin/batches/:id: batch row +
 * {expected, minted, tokens[]} assembled from the catalog_items rows.
 * Serves BOTH the wizard's step-2 status poll (T34) and the binding
 * station's resumable queue rebuild (T35 — station.ts BATCH_ID_RE mirrors
 * the one used here). Read-only — viewer-safe (the middleware session gate
 * is the outer wall, same posture as template GETs); admin key injected
 * server-side, no relayer tier.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!BATCH_ID_RE.test(params.id)) {
    return NextResponse.json({ ok: false, error: "id must be a batch id (bat_…)" }, { status: 400 });
  }
  const res = await batchesUpstream(`/api/v1/admin/batches/${params.id}`);
  return NextResponse.json(res.body, { status: res.status });
}
