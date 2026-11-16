import { NextRequest, NextResponse } from "next/server";

import { actorHeader, getActor, getTenant, tenantHeader } from "@/lib/actor";

/**
 * POST /api/a2a — relays one task from the console's agent pages to the TAG IT
 * agent gateway, with the services key attached server-side.
 *
 * Because it lends that key to the caller, it needs a signed-in session
 * (TAP-T02). The middleware already requires one; the check is repeated here
 * so a matcher regression cannot reopen the relay. The task is forwarded with
 * the caller's name and, for a brand user, the brand.
 *
 * There is no built-in key: if SERVICES_API_KEY is not configured the route
 * answers 500 and relays nothing.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GATEWAY_URL = process.env.A2A_GATEWAY_URL || "https://api.tagit.network";

export async function POST(req: NextRequest) {
  const actor = await getActor();
  if (actor === null) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const apiKey = process.env.SERVICES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "A2A proxy is not configured" }, { status: 500 });
  }

  try {
    const body = await req.json();

    // Always use the TAG IT gateway — agentUrl from the agent's tokenURI
    // is a metadata page, not an A2A endpoint
    const res = await fetch(`${GATEWAY_URL}/a2a`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...actorHeader(actor),
        ...tenantHeader(await getTenant()),
      },
      body: JSON.stringify(body.payload),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Gateway returned ${res.status}: ${text.slice(0, 200)}` },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `A2A proxy error: ${message}` }, { status: 500 });
  }
}
