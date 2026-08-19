import { NextResponse } from "next/server";
import { SERVICES_URL } from "@/lib/services";

/**
 * GET /api/asset/[tokenId]/price — public price proxy for the BuyWidget.
 *
 * The browser must never talk to tagit-services directly (SERVICES_URL is a
 * server-side concern and the services host is not a public CORS surface), so
 * the widget reads the canonical price through this pass-through. Always a
 * LIVE upstream read (`no-store`): the widget re-fetches immediately before
 * payment and a cached price would defeat that check. The services endpoint
 * itself is public (mounted before apiKeyAuth) — no key is attached here.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { tokenId: string } }) {
  const { tokenId } = params;
  if (!/^\d+$/.test(tokenId)) {
    return NextResponse.json({ error: "INVALID_TOKEN_ID" }, { status: 400 });
  }
  try {
    const upstream = await fetch(`${SERVICES_URL}/api/v1/assets/${tokenId}/price`, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    const body = await upstream
      .json()
      .catch(() => ({ error: `price upstream returned ${upstream.status}` }));
    return NextResponse.json(body, {
      status: upstream.status,
      headers: { "cache-control": "no-store" },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
