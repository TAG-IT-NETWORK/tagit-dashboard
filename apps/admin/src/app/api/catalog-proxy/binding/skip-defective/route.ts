import { NextResponse } from "next/server";

import { getActorRole } from "@/lib/actor-role";
import { canMutateCatalog } from "@/lib/catalog/template-logic";
import { BATCH_ID_RE } from "@/lib/binding/station";
import { templatesUpstream } from "@/lib/server/templates-upstream";

/**
 * POST /api/catalog-proxy/binding/skip-defective (META-T35 → T26 recovery
 * rail) — bookkeeping-only exception for a dead chip BEFORE bindTag; the
 * token stays MINTED and is re-served next-in-queue. Pass-through to
 * POST /api/v1/admin/binding/skip-defective. Mandatory reason enforced
 * upstream too; X-Actor names the operator in the append-only exception log.
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
  const { tokenId, batchId, tagUid, reason } = body ?? {};
  if (typeof tokenId !== "string" || !TOKEN_ID_RE.test(tokenId)) {
    return NextResponse.json(
      { ok: false, error: "tokenId must be a numeric string" },
      { status: 400 },
    );
  }
  if (typeof reason !== "string" || reason.trim().length === 0) {
    return NextResponse.json({ ok: false, error: "reason is required" }, { status: 400 });
  }
  if (batchId !== undefined && (typeof batchId !== "string" || !BATCH_ID_RE.test(batchId))) {
    return NextResponse.json({ ok: false, error: "batchId must be a batch id (bat_…)" }, { status: 400 });
  }
  if (tagUid !== undefined && (typeof tagUid !== "string" || tagUid.length === 0 || tagUid.length > 200)) {
    return NextResponse.json({ ok: false, error: "tagUid must be a short string" }, { status: 400 });
  }
  const res = await templatesUpstream("/api/v1/admin/binding/skip-defective", {
    method: "POST",
    body: {
      tokenId,
      reason: reason.trim(),
      ...(batchId !== undefined ? { batchId } : {}),
      ...(tagUid !== undefined ? { tagUid } : {}),
    },
  });
  return NextResponse.json(res.body, { status: res.status });
}
