import { NextRequest, NextResponse } from "next/server";

const GATEWAY_URL = process.env.A2A_GATEWAY_URL || "https://api.tagit.network";
// No dev-key fallback — fail closed if the gateway key isn't configured.
const API_KEY = process.env.API_KEY ?? process.env.A2A_API_KEY;

export async function POST(req: NextRequest) {
  try {
    if (!API_KEY) {
      return NextResponse.json(
        { error: "A2A gateway not configured" },
        { status: 500 },
      );
    }

    const body = await req.json();

    // Always use the TAG IT gateway — agentUrl from the agent's tokenURI
    // is a metadata page, not an A2A endpoint
    const targetUrl = GATEWAY_URL;

    const res = await fetch(`${targetUrl}/a2a`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
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
