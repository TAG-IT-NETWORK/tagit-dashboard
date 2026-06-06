import { NextResponse } from "next/server";

/**
 * "Tap to buy" settlement proxy.
 *
 * The buyer's browser POSTs { tokenId, buyerWallet } here; this server route
 * forwards it to tagit-services /api/v1/sale/settle with the services API key
 * injected server-side, so the key never reaches the device. The relayer there
 * calls TAGITCore.claim(tokenId, buyerWallet) — ACTIVATED -> CLAIMED — flipping
 * ownership to the buyer's Privy wallet on Base Sepolia.
 */

const SERVICES_URL =
  process.env.SERVICES_URL ||
  "https://tagit-services-31154571939.us-central1.run.app";
const SERVICES_API_KEY = process.env.SERVICES_API_KEY;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!SERVICES_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "SERVICES_API_KEY not configured on the server" },
      { status: 500 },
    );
  }

  let body: {
    tokenId?: unknown;
    buyerWallet?: unknown;
    paymentTxHash?: unknown;
    priceUsdc?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }

  const tokenId = String(body.tokenId ?? "");
  const buyerWallet = String(body.buyerWallet ?? "");
  if (!/^\d+$/.test(tokenId) || !/^0x[0-9a-fA-F]{40}$/.test(buyerWallet)) {
    return NextResponse.json(
      { ok: false, error: "tokenId (numeric) and buyerWallet (0x address) required" },
      { status: 400 },
    );
  }
  // Optional USDC payment proof (only present when payment is enabled).
  const paymentTxHash =
    typeof body.paymentTxHash === "string" && /^0x[0-9a-fA-F]{64}$/.test(body.paymentTxHash)
      ? body.paymentTxHash
      : undefined;
  const priceUsdc = typeof body.priceUsdc === "number" ? body.priceUsdc : undefined;

  try {
    const upstream = await fetch(`${SERVICES_URL}/api/v1/sale/settle`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${SERVICES_API_KEY}`,
      },
      body: JSON.stringify({ tokenId, buyerWallet, paymentTxHash, priceUsdc }),
    });
    const data = await upstream.json().catch(() => ({
      ok: false,
      error: `settle upstream returned ${upstream.status}`,
    }));
    return NextResponse.json(data, { status: upstream.status });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
