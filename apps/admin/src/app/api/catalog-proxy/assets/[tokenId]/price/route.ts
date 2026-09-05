import { NextResponse } from "next/server";

import { getActorRole } from "@/lib/actor-role";
import { canMutateCatalog } from "@/lib/catalog/template-logic";
import { templatesUpstream } from "@/lib/server/templates-upstream";

/**
 * PUT /api/catalog-proxy/assets/:id/price — UPDATE / DELIST / RELIST a
 * listing (LIST goes through binding/activate so activation + listing stay
 * one step). Operator role; pass-through to PUT /api/v1/assets/:id/price.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS = new Set(["UPDATE", "DELIST", "RELIST"]);
const PRICE_RE = /^\d{1,12}(\.\d{1,6})?$/;

export async function PUT(req: Request, { params }: { params: { tokenId: string } }) {
  if (!canMutateCatalog(await getActorRole())) {
    return NextResponse.json({ ok: false, error: "viewer role is read-only" }, { status: 403 });
  }
  if (!/^\d+$/.test(params.tokenId)) {
    return NextResponse.json({ ok: false, error: "token id must be numeric" }, { status: 400 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }
  const { action, priceUsdc, reason } = body ?? {};
  if (typeof action !== "string" || !ACTIONS.has(action)) {
    return NextResponse.json({ ok: false, error: "action must be UPDATE, DELIST or RELIST" }, { status: 400 });
  }
  if ((action === "UPDATE" || action === "RELIST") && (typeof priceUsdc !== "string" || !PRICE_RE.test(priceUsdc))) {
    return NextResponse.json({ ok: false, error: "priceUsdc must be a decimal USDC amount" }, { status: 400 });
  }
  const payload: Record<string, unknown> = { action };
  if (typeof priceUsdc === "string" && PRICE_RE.test(priceUsdc)) payload.priceUsdc = priceUsdc;
  if (typeof reason === "string" && reason.trim()) payload.reason = reason.trim();
  const res = await templatesUpstream(`/api/v1/assets/${params.tokenId}/price`, { method: "PUT", body: payload });
  return NextResponse.json(res.body, { status: res.status });
}
