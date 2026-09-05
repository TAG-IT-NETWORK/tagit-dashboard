import { NextResponse } from "next/server";

import { getActorRole } from "@/lib/actor-role";
import { canMutateCatalog } from "@/lib/catalog/template-logic";
import { templatesUpstream } from "@/lib/server/templates-upstream";

/**
 * POST /api/catalog-proxy/binding/activate — the station's "Activate & list"
 * step. BOUND → ACTIVATED through the relayer (ACTIVATOR key, never the
 * operator's wallet), then LIST each ACTIVATED token at priceUsdc when given.
 * Pass-through to POST /api/v1/admin/binding/activate, which sits behind
 * requireRelayerKey upstream — so this call carries the relayer key
 * (server-side only, same posture as bind / void-remint).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN_ID_RE = /^\d+$/;
const PRICE_RE = /^\d{1,12}(\.\d{1,6})?$/;

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
  const { tokenIds, priceUsdc } = body ?? {};
  if (
    !Array.isArray(tokenIds) ||
    tokenIds.length === 0 ||
    tokenIds.length > 100 ||
    !tokenIds.every((t) => typeof t === "string" && TOKEN_ID_RE.test(t))
  ) {
    return NextResponse.json(
      { ok: false, error: "tokenIds must be 1–100 numeric strings" },
      { status: 400 },
    );
  }
  if (priceUsdc !== undefined && (typeof priceUsdc !== "string" || !PRICE_RE.test(priceUsdc))) {
    return NextResponse.json(
      { ok: false, error: "priceUsdc must be a decimal USDC amount (up to 6 decimals)" },
      { status: 400 },
    );
  }
  const res = await templatesUpstream("/api/v1/admin/binding/activate", {
    method: "POST",
    body: { tokenIds, ...(priceUsdc !== undefined ? { priceUsdc } : {}) },
    relayer: true,
  });
  return NextResponse.json(res.body, { status: res.status });
}
