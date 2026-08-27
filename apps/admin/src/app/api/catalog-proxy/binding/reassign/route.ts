import { NextResponse } from "next/server";

import { getActorRole } from "@/lib/actor-role";
import { canMutateCatalog } from "@/lib/catalog/template-logic";
import { templatesUpstream } from "@/lib/server/templates-upstream";

/**
 * POST /api/catalog-proxy/binding/reassign (META-T35 → T26 recovery rail) —
 * "Fix last bind": wrong physical item tapped, swap the two tokens' content
 * while the anchor grace timer is still armed. Pass-through to
 * POST /api/v1/admin/binding/reassign; the SERVER decides grace validity
 * (409 GRACE_EXPIRED after 120s) — the client countdown is UX only.
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
  const { tokenId, targetTokenId, reason } = body ?? {};
  if (typeof tokenId !== "string" || !TOKEN_ID_RE.test(tokenId)) {
    return NextResponse.json(
      { ok: false, error: "tokenId must be a numeric string" },
      { status: 400 },
    );
  }
  if (typeof targetTokenId !== "string" || !TOKEN_ID_RE.test(targetTokenId)) {
    return NextResponse.json(
      { ok: false, error: "targetTokenId must be a numeric string" },
      { status: 400 },
    );
  }
  if (typeof reason !== "string" || reason.trim().length === 0) {
    return NextResponse.json({ ok: false, error: "reason is required" }, { status: 400 });
  }
  const res = await templatesUpstream("/api/v1/admin/binding/reassign", {
    method: "POST",
    body: { tokenId, targetTokenId, reason: reason.trim() },
  });
  return NextResponse.json(res.body, { status: res.status });
}
