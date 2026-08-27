import { NextResponse } from "next/server";

import { BATCH_ID_RE } from "@/lib/catalog/batch-logic";
import { batchesUpstreamCsv } from "@/lib/server/batches-upstream";

/**
 * GET /api/catalog-proxy/batches/:id/export.csv (META-T34) — step-3 label
 * export. Pass-through of GET /api/v1/admin/batches/:id/export.csv:
 * tokenId,tagUid,serial,verifyUrl — one row per minted token, every cell
 * quoted and formula-neutralized upstream (REQ-S-29 export guard, services
 * toCsv/csvNeutralize). Served as an attachment for the label printer /
 * binding-station handoff.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!BATCH_ID_RE.test(params.id)) {
    return NextResponse.json({ ok: false, error: "id must be a batch id (bat_…)" }, { status: 400 });
  }
  const res = await batchesUpstreamCsv(`/api/v1/admin/batches/${params.id}/export.csv`);
  if (res.csv === null) {
    return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
  }
  return new NextResponse(res.csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${params.id}-labels.csv"`,
      "cache-control": "no-store",
    },
  });
}
