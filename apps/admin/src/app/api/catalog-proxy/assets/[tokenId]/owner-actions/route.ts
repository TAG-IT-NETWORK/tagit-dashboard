import { NextResponse } from "next/server";

import { templatesUpstream } from "@/lib/server/templates-upstream";

/**
 * GET /api/catalog-proxy/assets/:tokenId/owner-actions — owner-initiated
 * lifecycle moves triggered from the TAG IT mobile app (flag, list, delist,
 * recycle, cancel-recycle), newest first. Mirrors GET
 * {SERVICES_URL}/api/v1/assets/:tokenId/owner-actions — that upstream route
 * is public (no API key, no `?owner=` needed to see every owner's actions
 * for the token); this proxy still goes through templatesUpstream for the
 * shared SERVICES_URL/timeout/tenant handling and `cache: "no-store"`, same
 * pattern as lifecycle/[tokenId] and ratings. Read-only — no RBAC escalation
 * needed (stays viewer-level, unlisted, like its GET siblings).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { tokenId: string } }) {
  if (!/^\d+$/.test(params.tokenId)) {
    return NextResponse.json({ ok: false, error: "tokenId must be numeric" }, { status: 400 });
  }
  const res = await templatesUpstream(`/api/v1/assets/${params.tokenId}/owner-actions`, { method: "GET" });
  return NextResponse.json(res.body, { status: res.status });
}
