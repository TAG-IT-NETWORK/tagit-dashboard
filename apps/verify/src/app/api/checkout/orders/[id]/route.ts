import { NextResponse } from "next/server";

import {
  ORDER_RATE_LIMIT,
  ORDER_RATE_WINDOW_SECONDS,
  isOrderId,
  parseOrderAnswer,
} from "@/lib/card-checkout";
import { clientKey, createRateLimitStore } from "@/lib/rate-limit";

/**
 * What became of a card order (TAP-T14): the return page asks here.
 *
 * A pass-through to GET /api/v1/checkout/orders/:id with the services key
 * attached server-side. The answer is four fields and no more: the order's
 * id, its item, its state in one word, and whether the item is on the
 * registry. No buyer, no amount, no payment reference.
 *
 * The order id is the only thing asked for. It is long and random, it was
 * given to the buyer who started the order, and knowing it changes nothing:
 * this route only reads.
 */

const SERVICES_URL = process.env.SERVICES_URL || "https://api.tagit.network";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" } as const;

function refuse(status: number, code: string, extra: Record<string, string> = {}) {
  return NextResponse.json({ ok: false, code }, { status, headers: { ...NO_STORE, ...extra } });
}

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (!isOrderId(id)) return refuse(400, "INVALID_REQUEST");

  const decision = await createRateLimitStore().hit(
    clientKey(req.headers, "order"),
    ORDER_RATE_LIMIT,
    ORDER_RATE_WINDOW_SECONDS,
  );
  if (!decision.allowed) {
    return refuse(429, "TOO_MANY_REQUESTS", { "retry-after": String(decision.resetSeconds) });
  }

  const servicesKey = process.env.SERVICES_API_KEY;
  if (!servicesKey) return refuse(503, "NOT_CONFIGURED");

  try {
    const upstream = await fetch(`${SERVICES_URL}/api/v1/checkout/orders/${id}`, {
      headers: { authorization: `Bearer ${servicesKey}` },
      cache: "no-store",
    });
    if (upstream.status === 404) return refuse(404, "NOT_FOUND");
    if (!upstream.ok) return refuse(502, "UNAVAILABLE");
    const order = parseOrderAnswer(await upstream.json().catch(() => null));
    if (!order || order.orderId !== id) return refuse(502, "UNAVAILABLE");
    return NextResponse.json({ ok: true, ...order }, { headers: NO_STORE });
  } catch {
    return refuse(502, "UNAVAILABLE");
  }
}
