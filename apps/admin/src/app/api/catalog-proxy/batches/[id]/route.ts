import { NextResponse } from "next/server";

import { BATCH_ID_RE } from "@/lib/binding/station";
import { templatesUpstream } from "@/lib/server/templates-upstream";

/**
 * GET /api/catalog-proxy/batches/:id (META-T35) — batch + per-token progress
 * for the binding station. Pass-through to GET /api/v1/admin/batches/:id;
 * admin key injected server-side. Read-only — no relayer tier, no X-Actor.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!BATCH_ID_RE.test(params.id)) {
    return NextResponse.json({ ok: false, error: "id must be a batch id (bat_…)" }, { status: 400 });
  }
  const res = await templatesUpstream(`/api/v1/admin/batches/${params.id}`);
  return NextResponse.json(res.body, { status: res.status });
}
