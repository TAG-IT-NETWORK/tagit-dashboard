import { NextResponse } from "next/server";

import { getActorRole } from "@/lib/actor-role";
import { canPublishCatalog } from "@/lib/catalog/template-logic";
import { templatesUpstream } from "@/lib/server/templates-upstream";

/**
 * POST /api/catalog-proxy/sale/settle — claim a LISTED + ACTIVATED asset to a wallet (ownership moves). Admin role.
 * Pass-through to /api/v1/sale/settle (relayer tier upstream — the relayer key
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
  const { tokenId, buyerWallet } = body ?? {};
  if (typeof tokenId !== "string" || !TOKEN_ID_RE.test(tokenId)) {
    return NextResponse.json({ ok: false, error: "tokenId must be a numeric string" }, { status: 400 });
  }
  if (typeof buyerWallet !== "string" || !EVM_ADDRESS_RE.test(buyerWallet)) {
    return NextResponse.json({ ok: false, error: "buyerWallet must be an EVM address" }, { status: 400 });
  }
  const payload = { tokenId, buyerWallet };
  const res = await templatesUpstream("/api/v1/sale/settle", { method: "POST", body: payload, relayer: true });
  return NextResponse.json(res.body, { status: res.status });
}
