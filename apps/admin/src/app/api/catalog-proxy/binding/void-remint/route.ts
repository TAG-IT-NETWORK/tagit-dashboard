import { NextResponse } from "next/server";

import { getActorRole } from "@/lib/actor-role";
import { canMutateCatalog } from "@/lib/catalog/template-logic";
import { templatesUpstream } from "@/lib/server/templates-upstream";

/**
 * POST /api/catalog-proxy/binding/void-remint (META-T35 → T26 recovery rail)
 * — post-grace recovery: recycle(tokenId) on-chain and remint the content as
 * a fresh token (202 async mint). Pass-through to
 * POST /api/v1/admin/binding/void-remint, which sits behind requireRelayerKey
 * upstream — so this call carries the second-tier relayer key (server-side
 * only). Mandatory reason + X-Actor ride into the append-only exception log;
 * the station wizard adds its own confirm step on top.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN_ID_RE = /^\d+$/;
const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

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
  const { tokenId, reason, remintTo } = body ?? {};
  if (typeof tokenId !== "string" || !TOKEN_ID_RE.test(tokenId)) {
    return NextResponse.json(
      { ok: false, error: "tokenId must be a numeric string" },
      { status: 400 },
    );
  }
  if (typeof reason !== "string" || reason.trim().length === 0) {
    return NextResponse.json({ ok: false, error: "reason is required" }, { status: 400 });
  }
  if (remintTo !== undefined && (typeof remintTo !== "string" || !EVM_ADDRESS_RE.test(remintTo))) {
    return NextResponse.json(
      { ok: false, error: "remintTo must be an EVM address" },
      { status: 400 },
    );
  }
  const res = await templatesUpstream("/api/v1/admin/binding/void-remint", {
    method: "POST",
    body: {
      tokenId,
      reason: reason.trim(),
      ...(remintTo !== undefined ? { remintTo } : {}),
    },
    relayer: true,
  });
  return NextResponse.json(res.body, { status: res.status });
}
