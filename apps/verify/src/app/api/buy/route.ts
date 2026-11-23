import { NextResponse } from "next/server";

import { BUY_RATE_LIMIT, BUY_RATE_WINDOW_SECONDS, parseBuyRequest } from "@/lib/buy-request";
import { clientKey, createRateLimitStore } from "@/lib/rate-limit";

/**
 * "Tap to buy" settlement proxy.
 *
 * The buyer's browser POSTs its purchase here; this server route forwards it
 * to tagit-services /api/v1/sale/settle with the services keys attached
 * server-side, so no key reaches the device. The relayer there calls
 * TAGITCore.claim(tokenId, buyerWallet), which registers the item to the
 * buyer's wallet.
 *
 * PROOF FIRST (TAP-T15). Those keys are what make a settle happen, so this
 * route must not lend them to a request that proves nothing. A request has to
 * bring the transaction hash of its USDC payment, or a demo order signed by
 * the buyer's wallet (@/lib/buy-request). One that brings neither is answered
 * 402 here and nothing is sent upstream. tagit-services checks the proof
 * itself: the payment on-chain, the signature against the buyer's address.
 *
 * Limited per address (10 a minute): a purchase is one request, and every
 * accepted one costs the relayer a transaction.
 *
 * What goes wrong on the way is never repeated to the caller in its own
 * words: an error's text can name this server's settings or the upstream host.
 */

const SERVICES_URL = process.env.SERVICES_URL || "https://api.tagit.network";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" } as const;

function refuse(status: number, code: string, extra: Record<string, string> = {}) {
  return NextResponse.json({ ok: false, code }, { status, headers: { ...NO_STORE, ...extra } });
}

export async function POST(req: Request) {
  const decision = await createRateLimitStore().hit(
    clientKey(req.headers, "buy"),
    BUY_RATE_LIMIT,
    BUY_RATE_WINDOW_SECONDS,
  );
  if (!decision.allowed) {
    return refuse(429, "TOO_MANY_REQUESTS", { "retry-after": String(decision.resetSeconds) });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return refuse(400, "INVALID_REQUEST");
  }
  const parsed = parseBuyRequest(body);
  if (!parsed.ok) return refuse(parsed.status, parsed.code);

  // Read per request, so a missing key is a refusal and never a half-built call.
  const servicesKey = process.env.SERVICES_API_KEY;
  const relayerKey = process.env.RELAYER_API_KEY;
  if (!servicesKey) return refuse(503, "NOT_CONFIGURED");

  try {
    const upstream = await fetch(`${SERVICES_URL}/api/v1/sale/settle`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${servicesKey}`,
        // Second-tier credential. settle makes the relayer broadcast a claim
        // transaction, so tagit-services requires this in addition to the
        // bearer token. Server-side only.
        ...(relayerKey ? { "x-relayer-key": relayerKey } : {}),
      },
      body: JSON.stringify(parsed.value),
      cache: "no-store",
    });
    const data: unknown = await upstream.json().catch(() => null);
    if (typeof data !== "object" || data === null) {
      return refuse(502, "UPSTREAM_FAILED");
    }
    return NextResponse.json(data, { status: upstream.status, headers: NO_STORE });
  } catch {
    return refuse(502, "UPSTREAM_FAILED");
  }
}
