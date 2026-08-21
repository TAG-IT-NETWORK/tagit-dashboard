import { NextResponse } from "next/server";

import { actorHeader, getActor } from "@/lib/actor";

/**
 * POST /api/mint-proxy — server-side proxy for the minimal mint form
 * (META-T18). Forwards to tagit-services with BOTH credentials injected
 * server-side (mint broadcasts a relayer transaction, so services requires
 * the relayer key on top of the general API key). Neither key ever reaches
 * the browser.
 *
 * Body: {
 *   to:            0x recipient (relayer-minted owner),
 *   docDraft:      free-form draft doc (media already linked inside it),
 *   mintRequestId: client-generated idempotency key (crypto.randomUUID()),
 *   priceUsdc?:    decimal string — when present and the mint succeeds, a
 *                  follow-up PUT /api/v1/assets/:tokenId/price {action:LIST}
 *                  lists the token at that price.
 * }
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SERVICES_URL = process.env.SERVICES_URL || "https://api.tagit.network";

const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;
// Mirror of tagit-services parseUsdcString (see src/lib/usdc.ts).
const USDC_RE = /^(0|[1-9]\d{0,11})(\.\d{1,6})?$/;

export async function POST(req: Request) {
  const apiKey = process.env.SERVICES_API_KEY;
  const relayerKey = process.env.RELAYER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "SERVICES_API_KEY not configured on the server" },
      { status: 500 },
    );
  }

  let body: {
    to?: unknown;
    docDraft?: unknown;
    mintRequestId?: unknown;
    priceUsdc?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }

  const to = String(body.to ?? "");
  const mintRequestId = String(body.mintRequestId ?? "");
  if (!ADDR_RE.test(to)) {
    return NextResponse.json({ ok: false, error: "to must be a 0x address" }, { status: 400 });
  }
  if (!mintRequestId || mintRequestId.length > 200) {
    return NextResponse.json({ ok: false, error: "mintRequestId required" }, { status: 400 });
  }
  if (typeof body.docDraft !== "object" || body.docDraft === null || Array.isArray(body.docDraft)) {
    return NextResponse.json({ ok: false, error: "docDraft must be an object" }, { status: 400 });
  }
  const priceUsdc =
    body.priceUsdc === undefined || body.priceUsdc === null || body.priceUsdc === ""
      ? undefined
      : String(body.priceUsdc);
  if (priceUsdc !== undefined && !USDC_RE.test(priceUsdc)) {
    return NextResponse.json(
      { ok: false, error: "priceUsdc must be a decimal string with at most 6 decimals" },
      { status: 400 },
    );
  }

  // REQ-S-16 (META-T32): name the signed-in human on every mutating call.
  const actor = await getActor();
  const authHeaders = {
    "content-type": "application/json",
    authorization: `Bearer ${apiKey}`,
    ...(relayerKey ? { "x-relayer-key": relayerKey } : {}),
    ...actorHeader(actor),
  };

  try {
    const mintRes = await fetch(`${SERVICES_URL}/api/v1/assets/mint`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ to, docDraft: body.docDraft, mintRequestId }),
    });
    const mintData = await mintRes
      .json()
      .catch(() => ({ ok: false, error: `mint upstream returned ${mintRes.status}` }));

    if (!mintRes.ok || !mintData.ok || !mintData.tokenId) {
      return NextResponse.json(mintData, { status: mintRes.ok ? 502 : mintRes.status });
    }

    // Optional listing — best-effort after a successful mint; a price failure
    // must not hide the minted token from the caller.
    let priceResult: unknown = undefined;
    if (priceUsdc !== undefined) {
      try {
        const priceRes = await fetch(`${SERVICES_URL}/api/v1/assets/${mintData.tokenId}/price`, {
          method: "PUT",
          headers: authHeaders,
          body: JSON.stringify({ action: "LIST", priceUsdc }),
        });
        priceResult = await priceRes
          .json()
          .catch(() => ({ ok: false, error: `price upstream returned ${priceRes.status}` }));
      } catch (e) {
        priceResult = { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    }

    return NextResponse.json({
      ok: true,
      tokenId: mintData.tokenId,
      txHash: mintData.txHash,
      created: mintData.created,
      ...(priceResult !== undefined ? { price: priceResult } : {}),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
