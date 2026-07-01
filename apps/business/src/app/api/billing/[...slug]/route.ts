import { type NextRequest, NextResponse } from "next/server";

/*
 * Same-origin proxy for USDC billing (T6b).
 *
 * Forwards /api/billing/*  ->  {TAGIT_SERVICES_URL}/api/v1/billing/*  (redeem),
 * passing the HttpOnly session cookie + the x-csrf-token double-submit header
 * through to the services tier, which re-verifies the session and the payment.
 *
 * NOT on the middleware PUBLIC allowlist — buying credits requires a signed-in
 * session, so the Edge gateway gates this route like any other /api/* path.
 */

const SERVICES_URL = process.env.TAGIT_SERVICES_URL ?? "http://localhost:3100";

async function forward(req: NextRequest, slug: string[]): Promise<NextResponse> {
  const target = `${SERVICES_URL}/api/v1/billing/${slug.join("/")}`;

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
    return NextResponse.json({ ok: false, error: "billing service unreachable" }, { status: 502 });
  }

  const body = await upstream.text();
  const res = new NextResponse(body, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });
  for (const c of upstream.headers.getSetCookie()) {
    res.headers.append("set-cookie", c);
  }
  return res;
}

export async function POST(req: NextRequest, ctx: { params: { slug: string[] } }) {
  return forward(req, ctx.params.slug);
}
