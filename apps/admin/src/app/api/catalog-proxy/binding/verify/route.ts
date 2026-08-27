import { NextResponse } from "next/server";

import { getActorRole } from "@/lib/actor-role";
import { canMutateCatalog } from "@/lib/catalog/template-logic";
import { templatesUpstream } from "@/lib/server/templates-upstream";

/**
 * POST /api/catalog-proxy/binding/verify (META-T35, REQ-S-21; WB-01) — SUN
 * check for the chip on the antenna BEFORE bindTag. Pass-through to the
 * ADMIN rail POST /api/v1/admin/binding/verify ({tokenId, nfcPayload:{uid,
 * cmac, counter}}): the SAME shared SUN core as the public verify (AN12196
 * SDMMAC + DB-backed counter anti-replay + oracle proof) but behind
 * apiKeyAuth with NO x402 gate — the station must never ride the paid public
 * rail. Tenancy: services scopes the tokenId through catalog_items first, so
 * a foreign token 404s before any counter/key work. The response carries
 * `cmacVerified` (false when SDM_MASTER_KEY is not provisioned upstream —
 * counter-only check) and `reason:'CMAC_INVALID'` on a cryptographic MAC
 * mismatch; the station UI surfaces both. Proxied so the station stays
 * same-origin (no CORS) and the services credentials stay server-side.
 *
 * Gated at operator level like the bind rail — a verify consumes the SUN
 * counter for the token, so it is part of the bind flow, not a public read.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN_ID_RE = /^\d+$/;
const HEX_RE = /^0x[0-9a-fA-F]+$/;

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
  const nfcPayload = body?.nfcPayload as Record<string, unknown> | undefined;
  if (typeof tokenId !== "string" || !TOKEN_ID_RE.test(tokenId)) {
    return NextResponse.json(
      { ok: false, error: "tokenId must be a numeric string" },
      { status: 400 },
    );
  }
  const uid = nfcPayload?.uid;
  const cmac = nfcPayload?.cmac;
  const counter = nfcPayload?.counter;
  if (
    typeof uid !== "string" ||
    !HEX_RE.test(uid) ||
    typeof cmac !== "string" ||
    !HEX_RE.test(cmac) ||
    typeof counter !== "number" ||
    !Number.isInteger(counter) ||
    counter < 0
  ) {
    return NextResponse.json(
      { ok: false, error: "nfcPayload must carry hex uid, hex cmac, and a non-negative counter" },
      { status: 400 },
    );
  }
  const res = await templatesUpstream("/api/v1/admin/binding/verify", {
    method: "POST",
    body: { tokenId: Number(tokenId), nfcPayload: { uid, cmac, counter } },
  });
  return NextResponse.json(res.body, { status: res.status });
}
