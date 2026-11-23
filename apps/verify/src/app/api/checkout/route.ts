import { NextResponse } from "next/server";

import {
  CHECKOUT_RATE_LIMIT,
  CHECKOUT_RATE_WINDOW_SECONDS,
  checkoutFailure,
  isOrderId,
  safeCheckoutUrl,
} from "@/lib/card-checkout";
import { parseCheckoutRequest } from "@/lib/card-checkout-request";
import { clientKey, createRateLimitStore } from "@/lib/rate-limit";

/**
 * "Pay by card": asks tagit-services for a checkout page (TAP-T14).
 *
 * The buyer's browser POSTs { tokenId, buyerWallet, productName? } here. This
 * route forwards exactly those to POST /api/v1/checkout/sessions with the
 * services key attached server-side, and answers { orderId, url }.
 *
 * WHAT THIS ROUTE CANNOT DO. It cannot set a price, mark anything paid, or
 * move an item: tagit-services reads the price from its own listing, and an
 * order becomes paid only on the payment provider's signed message. The worst
 * a made-up request gets is a checkout page where somebody may pay the real
 * price for an item that then goes to the wallet named.
 *
 * The address it answers with is checked (@/lib/card-checkout): the buyer is
 * only ever sent to the provider's own checkout host.
 *
 * Limited per address. Failures are answered with a code, never with an
 * error's own text.
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
    clientKey(req.headers, "checkout"),
    CHECKOUT_RATE_LIMIT,
    CHECKOUT_RATE_WINDOW_SECONDS,
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
  const request = parseCheckoutRequest(body);
  if (!request) return refuse(400, "INVALID_REQUEST");

  const servicesKey = process.env.SERVICES_API_KEY;
  if (!servicesKey) return refuse(503, "NOT_CONFIGURED");

  try {
    const upstream = await fetch(`${SERVICES_URL}/api/v1/checkout/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${servicesKey}` },
      body: JSON.stringify(request),
      cache: "no-store",
    });
    const data = (await upstream.json().catch(() => null)) as Record<string, unknown> | null;
    if (upstream.status === 401 || upstream.status === 403) return refuse(503, "NOT_CONFIGURED");
    if (!upstream.ok) {
      const code = checkoutFailure(data?.error ?? data?.code);
      return refuse(code === "UNAVAILABLE" ? 502 : 409, code);
    }
    const url = safeCheckoutUrl(data?.url);
    if (!url || !isOrderId(data?.orderId)) return refuse(502, "UNAVAILABLE");
    return NextResponse.json({ ok: true, orderId: data.orderId, url }, { headers: NO_STORE });
  } catch {
    return refuse(502, "UNAVAILABLE");
  }
}
