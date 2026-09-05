import { NextResponse } from "next/server";

import { getActorRole } from "@/lib/actor-role";
import { canMutateCatalog } from "@/lib/catalog/template-logic";
import { templatesUpstream } from "@/lib/server/templates-upstream";

/**
 * POST /api/catalog-proxy/lifecycle/flag — BOUND/ACTIVATED/CLAIMED → FLAGGED (delists a listed item). Operator role.
 * Pass-through to /api/v1/admin/lifecycle/flag (relayer tier upstream — the relayer key
 * stays server-side; the operator's wallet never signs lifecycle moves).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN_ID_RE = /^\d+$/;
const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
void EVM_ADDRESS_RE;

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
  const { tokenIds, reason } = body ?? {};
  if (!Array.isArray(tokenIds) || tokenIds.length === 0 || tokenIds.length > 100 || !tokenIds.every((t) => typeof t === "string" && TOKEN_ID_RE.test(t))) {
    return NextResponse.json({ ok: false, error: "tokenIds must be 1–100 numeric strings" }, { status: 400 });
  }
  if (typeof reason !== "string" || reason.trim().length === 0) {
    return NextResponse.json({ ok: false, error: "reason is required" }, { status: 400 });
  }
  const payload = { tokenIds, reason: reason.trim() };
  const res = await templatesUpstream("/api/v1/admin/lifecycle/flag", { method: "POST", body: payload, relayer: true });
  return NextResponse.json(res.body, { status: res.status });
}
