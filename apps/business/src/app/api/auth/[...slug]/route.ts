import { type NextRequest, NextResponse } from "next/server";

/*
 * Same-origin proxy for the SIWE auth flow.
 *
 * Forwards /api/auth/*  ->  {TAGIT_SERVICES_URL}/api/v1/auth/*  (nonce / verify /
 * refresh / logout / me), passing cookies BOTH ways so the HttpOnly session cookie
 * the services tier sets lands same-origin on the dashboard host (works in dev on
 * localhost and in prod under .tagit.network). The /api/auth/* prefix is on the
 * middleware PUBLIC allowlist — login must work before a session exists.
 */

const SERVICES_URL = process.env.TAGIT_SERVICES_URL ?? "http://localhost:3100";

async function forward(req: NextRequest, slug: string[]): Promise<NextResponse> {
  const target = `${SERVICES_URL}/api/v1/auth/${slug.join("/")}`;

  const headers: Record<string, string> = {
    "content-type": req.headers.get("content-type") ?? "application/json",
  };
  const cookie = req.headers.get("cookie");
  if (cookie) headers.cookie = cookie;
  const csrf = req.headers.get("x-csrf-token");
  if (csrf) headers["x-csrf-token"] = csrf;

  const init: RequestInit = { method: req.method, headers, cache: "no-store" };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.text();
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch {
    return NextResponse.json({ ok: false, error: "auth service unreachable" }, { status: 502 });
  }

  const body = await upstream.text();
  const res = new NextResponse(body, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });
  // Relay Set-Cookie (session / refresh / csrf) back to the browser.
  for (const c of upstream.headers.getSetCookie()) {
    res.headers.append("set-cookie", c);
  }
  return res;
}

export async function GET(req: NextRequest, ctx: { params: { slug: string[] } }) {
  return forward(req, ctx.params.slug);
}

export async function POST(req: NextRequest, ctx: { params: { slug: string[] } }) {
  return forward(req, ctx.params.slug);
}
