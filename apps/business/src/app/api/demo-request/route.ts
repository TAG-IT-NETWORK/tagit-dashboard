import { NextResponse } from "next/server";

/*
 * Server-side proxy to the tagit-services leads endpoint.
 *
 * The request-demo form on the public marketing landing posts here so the
 * browser never has to know the services URL. The leads endpoint is PUBLIC
 * (prospects are unauthenticated), so no API key is forwarded — this route
 * just relays the JSON body and mirrors the upstream status + payload.
 */

const SERVICES_URL = process.env.TAGIT_SERVICES_URL ?? "http://localhost:3100";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${SERVICES_URL}/api/v1/leads`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = await upstream
      .json()
      .catch(() => ({ ok: false, error: "bad gateway response" }));
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json(
      { ok: false, error: "upstream_unavailable" },
      { status: 502 },
    );
  }
}
