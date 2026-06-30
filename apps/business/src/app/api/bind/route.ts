import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, issueCallerAssertion, verifySession, isEnforcing } from "@/lib/session";

/*
 * Server-side proxy to the tagit-services bind relayer.
 *
 * Binding can't be done client-side: TAGITCore.bindTag needs an oracle signature
 * (recovering to the on-chain trustedOracle) and a BINDER-capable sender. The
 * services relayer holds both. This route forwards to it so the services API key
 * stays on the server, never in the browser.
 *
 * Auth: the session cookie is re-verified here at the relay boundary (we do NOT
 * trust the x-tagit-* headers the middleware injects). When a valid session
 * exists we mint a 60s caller-assertion (cap "BINDER") and forward it as the
 * x-tagit-caller header ALONGSIDE the existing Bearer service key, so the relay
 * can attribute the bind to the end-user wallet + account. Gated by AUTH_ENFORCE.
 */

const SERVICES_URL = process.env.TAGIT_SERVICES_URL ?? "http://localhost:3100";
const SERVICES_API_KEY = process.env.TAGIT_SERVICES_API_KEY ?? "";

export async function POST(req: NextRequest) {
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

  // Re-verify the session at the relay boundary.
  const claims = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);

  if (!claims) {
    if (isEnforcing()) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    console.warn(
      "[auth] REPORT-ONLY: would deny POST /api/bind (no valid tagit_session) — forwarding without caller-assertion",
    );
  }

  // Mint a 60s caller-assertion attributing this bind to the end-user.
  let callerAssertion: string | null = null;
  if (claims) {
    try {
      callerAssertion = await issueCallerAssertion({
        sub: claims.sub,
        act: claims.act,
        cap: "BINDER",
        tokenId,
      });
    } catch (e) {
      // e.g. SESSION_JWT_SECRET unset. A session existed but we cannot mint:
      // fail closed when enforcing, otherwise warn and forward.
      if (isEnforcing()) {
        return NextResponse.json(
          { ok: false, error: "caller-assertion unavailable" },
          { status: 401 },
        );
      }
      console.warn(
        `[auth] REPORT-ONLY: could not mint caller-assertion: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }

  try {
    const upstream = await fetch(`${SERVICES_URL}/api/v1/bind`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(SERVICES_API_KEY ? { authorization: `Bearer ${SERVICES_API_KEY}` } : {}),
        ...(callerAssertion ? { "x-tagit-caller": callerAssertion } : {}),
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
