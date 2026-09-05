import { NextResponse } from "next/server";

import { templatesUpstream } from "@/lib/server/templates-upstream";

/** GET /api/catalog-proxy/lifecycle/:tokenId — on-chain state, sale state and the resolve round (viewer-level). */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { tokenId: string } }) {
  if (!/^\d+$/.test(params.tokenId)) {
    return NextResponse.json({ ok: false, error: "tokenId must be numeric" }, { status: 400 });
  }
  const res = await templatesUpstream(`/api/v1/admin/lifecycle/${params.tokenId}`, { method: "GET" });
  return NextResponse.json(res.body, { status: res.status });
}
