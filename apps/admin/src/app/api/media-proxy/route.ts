import { NextResponse } from "next/server";

/**
 * POST /api/media-proxy — server-side multipart pass-through to the
 * tagit-services media pipeline (POST {SERVICES_URL}/api/v1/media).
 *
 * WHY A PROXY: the media endpoint requires the admin API key, and that key
 * must NEVER reach the browser. The form uploads here; this route streams the
 * multipart body upstream untouched and injects the Authorization header
 * server-side. The response (sha256, variant URLs, lqip, …) is passed back
 * verbatim — it never contains the key.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Media uploads are large; disable any body parsing/caching layers. */
export const maxDuration = 60;

const SERVICES_URL = process.env.SERVICES_URL || "https://api.tagit.network";

export async function POST(req: Request) {
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

  try {
    const upstream = await fetch(`${SERVICES_URL}/api/v1/media`, {
      method: "POST",
      headers: {
        // Preserve the multipart boundary exactly; never forward the
        // browser's cookies or other headers.
        "content-type": contentType,
        authorization: `Bearer ${apiKey}`,
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
