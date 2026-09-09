import { NextResponse } from "next/server";

import { templatesUpstream } from "@/lib/server/templates-upstream";

/** GET /api/catalog-proxy/ratings?tokenId= — ratings incl. hidden rows (viewer-level read). */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const tokenId = new URL(req.url).searchParams.get("tokenId") ?? "";
  if (!/^\d+$/.test(tokenId)) return NextResponse.json({ ok: false, error: "tokenId must be numeric" }, { status: 400 });
  const res = await templatesUpstream(`/api/v1/admin/ratings?tokenId=${tokenId}`, { method: "GET" });
  return NextResponse.json(res.body, { status: res.status });
}
