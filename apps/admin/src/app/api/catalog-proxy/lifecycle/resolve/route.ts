import { NextResponse } from "next/server";

import { getActorRole } from "@/lib/actor-role";
import { canPublishCatalog } from "@/lib/catalog/template-logic";
import { templatesUpstream } from "@/lib/server/templates-upstream";

/**
 * POST /api/catalog-proxy/lifecycle/resolve — relayer approveResolve (+ resolve once the 2-of-N quorum is met). Admin role.
 * Pass-through to /api/v1/admin/lifecycle/resolve (relayer tier upstream — the relayer key
 * stays server-side; the operator's wallet never signs lifecycle moves).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN_ID_RE = /^\d+$/;
const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
void EVM_ADDRESS_RE;

export async function POST(req: Request) {
  if (!canPublishCatalog(await getActorRole())) {
    return NextResponse.json({ ok: false, error: "admin role required" }, { status: 403 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }
  const { tokenId, newOwner, reason } = body ?? {};
  if (typeof tokenId !== "string" || !TOKEN_ID_RE.test(tokenId)) {
    return NextResponse.json({ ok: false, error: "tokenId must be a numeric string" }, { status: 400 });
  }
  if (newOwner !== undefined && (typeof newOwner !== "string" || !EVM_ADDRESS_RE.test(newOwner))) {
    return NextResponse.json({ ok: false, error: "newOwner must be an EVM address" }, { status: 400 });
  }
  if (typeof reason !== "string" || reason.trim().length === 0) {
    return NextResponse.json({ ok: false, error: "reason is required" }, { status: 400 });
  }
  const payload = { tokenId, reason: reason.trim(), ...(newOwner !== undefined ? { newOwner } : {}) };
  const res = await templatesUpstream("/api/v1/admin/lifecycle/resolve", { method: "POST", body: payload, relayer: true });
  return NextResponse.json(res.body, { status: res.status });
}
