/**
 * Edge middleware — gates the internal agent dev-ops dashboard.
 *
 * Vercel Authentication (SSO deployment protection) is a Pro-plan feature and
 * the team is on free, so we gate `/agent` with HTTP Basic Auth at the edge.
 * Credentials come from env (AGENT_DASH_USER / AGENT_DASH_PASS). The rest of
 * the console (/assets, /badges) is left open in case those become public B2B
 * pages.
 *
 * If the env vars are unset, the route stays OPEN (fail-open) so a missing
 * config doesn't lock you out — but they ARE set in Vercel for production.
 */

import { NextResponse, type NextRequest } from "next/server";

export const config = {
  matcher: ["/agent/:path*"],
};

export function middleware(req: NextRequest) {
  const user = process.env.AGENT_DASH_USER;
  const pass = process.env.AGENT_DASH_PASS;

  // Fail-open if not configured (avoids accidental lockout in local/dev).
  if (!user || !pass) return NextResponse.next();

  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    try {
      const decoded = atob(auth.slice(6));
      const idx = decoded.indexOf(":");
      const u = decoded.slice(0, idx);
      const p = decoded.slice(idx + 1);
      if (u === user && p === pass) return NextResponse.next();
    } catch {
      /* fall through to challenge */
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="tagit-agent", charset="UTF-8"' },
  });
}
