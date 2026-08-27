import { NextResponse } from "next/server";

import { actorHeader, getActor } from "@/lib/actor";
import { getActorRole } from "@/lib/actor-role";
import { canMutateCatalog } from "@/lib/catalog/template-logic";

/**
 * POST /api/media-proxy — server-side multipart pass-through to the
 * tagit-services media pipeline (POST {SERVICES_URL}/api/v1/media).
 *
 * WHY A PROXY: the media endpoint requires the admin API key, and that key
 * must NEVER reach the browser. The form uploads here; this route streams the
 * multipart body upstream untouched and injects the Authorization header
 * server-side. The response (sha256, variant URLs, lqip, …) is passed back
 * verbatim — it never contains the key.
 *
 * REQ-S-16 (META-T32): the signed-in user's email is forwarded as X-Actor so
 * the services audit log names the human behind the upload.
 *
 * WB-07: the route re-checks the session role in-route (operator+ via
 * canMutateCatalog) like every other mutating proxy — the middleware is the
 * first gate, never the only one.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Media uploads are large; disable any body parsing/caching layers. */
export const maxDuration = 60;

const SERVICES_URL = process.env.SERVICES_URL || "https://api.tagit.network";

export async function POST(req: Request) {
  // WB-07: in-route role re-check (operator+) — defense in depth behind the
  // middleware path gate.
  if (!canMutateCatalog(await getActorRole())) {
    return NextResponse.json({ ok: false, error: "viewer role is read-only" }, { status: 403 });
  }

  const apiKey = process.env.SERVICES_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "SERVICES_API_KEY not configured on the server" },
      { status: 500 },
    );
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data")) {
    return NextResponse.json({ ok: false, error: "expected multipart/form-data" }, { status: 400 });
  }

  const actor = await getActor();

  try {
    const upstream = await fetch(`${SERVICES_URL}/api/v1/media`, {
      method: "POST",
      headers: {
        // Preserve the multipart boundary exactly; never forward the
        // browser's cookies or other headers.
        "content-type": contentType,
        authorization: `Bearer ${apiKey}`,
        ...actorHeader(actor),
      },
      body: req.body,
      // Node fetch requires half-duplex for streamed request bodies.
      // @ts-expect-error -- duplex is a Node/undici extension missing from lib.dom types
      duplex: "half",
    });

    const body = await upstream
      .json()
      .catch(() => ({ ok: false, error: `media upstream returned ${upstream.status}` }));
    return NextResponse.json(body, { status: upstream.status });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
