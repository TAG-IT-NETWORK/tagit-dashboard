import { NextResponse } from "next/server";

import { getActorRole } from "@/lib/actor-role";
import { canMutateCatalog } from "@/lib/catalog/template-logic";
import { templatesUpstream } from "@/lib/server/templates-upstream";

/**
 * POST /api/catalog-proxy/binding/bind (META-T35) — oracle-attested bindTag
 * via the funded relayer. Pass-through to POST /api/v1/bind, which sits
 * behind requireRelayerKey upstream, so the call carries the second-tier
 * relayer key (server-side only, same as propagate/execute). REQ-S-16:
 * X-Actor injected inside templatesUpstream.
 *
 * REQ-S-21 note: the SUN check happens BEFORE this call in the station flow;
 * this proxy is deliberately dumb — it never decides bind eligibility.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN_ID_RE = /^\d+$/;

export async function POST(req: Request) {
  if (!canMutateCatalog(await getActorRole())) {
    return NextResponse.json({ ok: false, error: "viewer role is read-only" }, { status: 403 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }
  const tokenId = body?.tokenId;
  const tagUid = body?.tagUid;
  if (typeof tokenId !== "string" || !TOKEN_ID_RE.test(tokenId)) {
    return NextResponse.json(
      { ok: false, error: "tokenId must be a numeric string" },
      { status: 400 },
    );
  }
  if (typeof tagUid !== "string" || tagUid.length === 0 || tagUid.length > 256) {
    return NextResponse.json({ ok: false, error: "tagUid is required" }, { status: 400 });
  }
  const res = await templatesUpstream("/api/v1/bind", {
    method: "POST",
    body: { tokenId, tagUid },
    relayer: true,
  });
  return NextResponse.json(res.body, { status: res.status });
}
