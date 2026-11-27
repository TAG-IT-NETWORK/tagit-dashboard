import { NextResponse } from "next/server";

import { getActorRole } from "@/lib/actor-role";
import { BATCH_ID_RE } from "@/lib/catalog/batch-logic";
import { canMutateCatalog } from "@/lib/catalog/template-logic";
import { batchesUpstream } from "@/lib/server/batches-upstream";

/**
 * POST /api/catalog-proxy/batches/:id/execute (META-T34) — step-2 mint.
 *
 * Upstream POST /api/v1/admin/batches/:id/execute broadcasts ONE relayer-
 * funded batchMint and sits behind requireRelayerKey (services server.ts), so
 * BOTH credentials are injected server-side — the same admin rail as the T33
 * propagate proxy and mint-proxy. 202 {ok, batchId, status:'minting',
 * statusUrl} (T21/T25 async pattern — poll the status proxy); 200 when the
 * batch already minted (idempotent re-execute).
 *
 * Body: { to?: 0x…, chainId?: number } — `to` is the address holding the
 * whole batch pre-bind. It is needed for a batch with no brand and left out
 * for a brand's batch, which goes to the brand's mint wallet (TAP-T17).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!BATCH_ID_RE.test(params.id)) {
    return NextResponse.json(
      { ok: false, error: "id must be a batch id (bat_…)" },
      { status: 400 },
    );
  }
  if (!canMutateCatalog(await getActorRole())) {
    return NextResponse.json({ ok: false, error: "viewer role is read-only" }, { status: 403 });
  }

  let body: { to?: unknown; chainId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }
  // `to` may be left out (TAP-T17): tagit-services sends a brand's batch to
  // the brand's own mint wallet and needs no address for it. For a batch
  // with no brand it answers with a 400 of its own when the address is
  // missing. When an address IS sent it must look like one.
  let to: string | undefined;
  if (body.to !== undefined && body.to !== null) {
    if (typeof body.to !== "string" || !ADDR_RE.test(body.to)) {
      return NextResponse.json(
        {
          ok: false,
          error: "to must be an EVM address (mint recipient holding the batch pre-bind)",
        },
        { status: 400 },
      );
    }
    to = body.to;
  }
  let chainId: number | undefined;
  if (body.chainId !== undefined) {
    if (typeof body.chainId !== "number" || !Number.isInteger(body.chainId) || body.chainId <= 0) {
      return NextResponse.json(
        { ok: false, error: "chainId must be a positive integer" },
        { status: 400 },
      );
    }
    chainId = body.chainId;
  }

  const res = await batchesUpstream(`/api/v1/admin/batches/${params.id}/execute`, {
    method: "POST",
    relayer: true,
    json: { ...(to !== undefined ? { to } : {}), ...(chainId !== undefined ? { chainId } : {}) },
  });
  return NextResponse.json(res.body, { status: res.status });
}
