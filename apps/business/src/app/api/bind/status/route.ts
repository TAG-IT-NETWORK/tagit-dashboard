import { NextResponse } from "next/server";

/*
 * Server-side proxy to the tagit-services bind relayer status.
 * Reports whether the relayer is funded, holds BINDER, and whether the oracle
 * key matches the on-chain trustedOracle — a readiness check for Settings.
 * The services API key stays on the server.
 */

const SERVICES_URL = process.env.TAGIT_SERVICES_URL ?? "http://localhost:3100";
const SERVICES_API_KEY = process.env.TAGIT_SERVICES_API_KEY ?? "";

export async function GET() {
  try {
    const upstream = await fetch(`${SERVICES_URL}/api/v1/bind/status`, {
      headers: { ...(SERVICES_API_KEY ? { authorization: `Bearer ${SERVICES_API_KEY}` } : {}) },
      cache: "no-store",
    });
    const data = await upstream
      .json()
      .catch(() => ({ configured: false, error: "bad gateway response" }));
    return NextResponse.json(data, { status: upstream.status });
  } catch (e) {
    return NextResponse.json(
      { configured: false, error: e instanceof Error ? e.message : "bind service unreachable" },
      { status: 502 },
    );
  }
}
