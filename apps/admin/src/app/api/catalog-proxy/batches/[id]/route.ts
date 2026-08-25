import { NextResponse } from "next/server";

import { BATCH_ID_RE } from "@/lib/catalog/batch-logic";
import { batchesUpstream } from "@/lib/server/batches-upstream";

/**
 * GET /api/catalog-proxy/batches/:id (META-T34) — step-2 status poll.
 * Pass-through to GET /api/v1/admin/batches/:id: batch row + per-token
 * progress ({expected, minted, tokens[]}) assembled from the catalog_items
 * rows as the mint continuation inserts them. Read-only — viewer-safe (the
 * middleware session gate is the outer wall, same posture as template GETs).
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
