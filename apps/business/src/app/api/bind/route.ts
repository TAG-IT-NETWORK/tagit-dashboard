import { NextResponse } from "next/server";

/*
 * Server-side proxy to the tagit-services bind relayer.
 *
 * Binding can't be done client-side: TAGITCore.bindTag needs an oracle signature
 * (recovering to the on-chain trustedOracle) and a BINDER-capable sender. The
 * services relayer holds both. This route forwards to it so the services API key
 * stays on the server, never in the browser.
 */

const SERVICES_URL = process.env.TAGIT_SERVICES_URL ?? "http://localhost:3100";
const SERVICES_API_KEY = process.env.TAGIT_SERVICES_API_KEY ?? "";
// Second-tier credential for relayer-backed writes. bind causes the funded
// signer to sign as oracle and submit bindTag on-chain, so tagit-services
// requires this alongside the bearer token.
const RELAYER_API_KEY = process.env.RELAYER_API_KEY ?? "";

export async function POST(req: Request) {
  let body: { tokenId?: string; tagUid?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const { tokenId, tagUid } = body;
  if (!tokenId || !tagUid) {
    return NextResponse.json(
      { ok: false, error: "tokenId and tagUid are required" },
      { status: 400 },
    );
  }

  try {
    const upstream = await fetch(`${SERVICES_URL}/api/v1/bind`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(SERVICES_API_KEY ? { authorization: `Bearer ${SERVICES_API_KEY}` } : {}),
        ...(RELAYER_API_KEY ? { "x-relayer-key": RELAYER_API_KEY } : {}),
      },
      body: JSON.stringify({ tokenId, tagUid }),
      cache: "no-store",
    });
    const data = await upstream.json().catch(() => ({ ok: false, error: "bad gateway response" }));
    return NextResponse.json(data, { status: upstream.status });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "bind service unreachable" },
      { status: 502 },
    );
  }
}
