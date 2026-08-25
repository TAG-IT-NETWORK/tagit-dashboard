import { NextResponse } from "next/server";

import { getActorRole } from "@/lib/actor-role";
import { BATCH_ID_RE } from "@/lib/catalog/batch-logic";
import { canPublishCatalog } from "@/lib/catalog/template-logic";
import { batchesUpstream } from "@/lib/server/batches-upstream";

/**
 * POST /api/catalog-proxy/batches/:id/unstick (META-T34) — ADMIN-ONLY rescue
 * for a batch stranded in 'minting' (crashed execute continuation). Upstream
 * resolves the truth from the chain and broadcasts NOTHING (batch.ts wave-2
 * F4), so the plain admin key suffices — no relayer tier. Returns
 * {ok, batchId, status, action} where action names what the chain showed
 * (finalized_from_receipt / reverted_reset / tx_unconfirmed_reset /
 * no_broadcast_reset / in_flight).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  if (!BATCH_ID_RE.test(params.id)) {
    return NextResponse.json({ ok: false, error: "id must be a batch id (bat_…)" }, { status: 400 });
  }
  if (!canPublishCatalog(await getActorRole())) {
    // Stricter than the other batch writes: unstick force-resets server state.
    return NextResponse.json({ ok: false, error: "unstick requires the admin role" }, { status: 403 });
  }
  const res = await batchesUpstream(`/api/v1/admin/batches/${params.id}/unstick`, {
    method: "POST",
    json: {},
  });
  return NextResponse.json(res.body, { status: res.status });
}
