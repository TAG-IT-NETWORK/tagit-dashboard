import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession, isEnforcing } from "@/lib/session";

/**
 * Edge default-DENY gateway for the business app.
 *
 * Every request that is not on the PUBLIC allowlist must carry a valid
 * tagit_session cookie. Behaviour is gated by AUTH_ENFORCE so the gateway can
 * ship "dark" before being switched on:
 *   AUTH_ENFORCE != "true" (default) → REPORT-ONLY: console.warn the would-be
 *     deny, then ALLOW (so false 401s surface in logs before enforcement).
 *   AUTH_ENFORCE == "true"           → ENFORCE: 401 JSON for /api/*, redirect to
 *     "/" for page requests.
 *
 * Anti-spoof: inbound x-tagit-* request headers are ALWAYS stripped first; the
 * trusted x-tagit-wallet / x-tagit-account / x-tagit-role headers are then
 * re-injected ONLY from the cryptographically verified session claims.
 */

// PUBLIC allowlist — exact paths plus their subpaths (except "/").
const PUBLIC_PATHS = [
  "/", // marketing home
  "/pricing",
  "/api/auth", // sign-in / siwe / session endpoints (+ subpaths)
  "/api/demo-request", // public lead form — MUST stay public
];

// Static public assets that must never require a session. (Most are already
// excluded by the matcher below; listed here as a defensive belt-and-suspenders.)
const PUBLIC_FILES = ["/favicon.ico", "/tagit_logo.png"];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_FILES.includes(pathname)) return true;
  for (const p of PUBLIC_PATHS) {
    if (pathname === p) return true;
    if (p !== "/" && pathname.startsWith(`${p}/`)) return true;
  }
  return false;
}

/** Drop any client-supplied x-tagit-* headers so they can never be spoofed. */
function stripTagitHeaders(source: Headers): Headers {
  const cleaned = new Headers(source);
  for (const key of [...cleaned.keys()]) {
    if (key.toLowerCase().startsWith("x-tagit-")) cleaned.delete(key);
  }
  return cleaned;
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  // ALWAYS start from a header set with NO inbound x-tagit-* headers.
  const requestHeaders = stripTagitHeaders(req.headers);
  const allow = (): NextResponse => NextResponse.next({ request: { headers: requestHeaders } });

  if (isPublicPath(pathname)) {
    return allow();
  }

  const claims = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);

  if (claims) {
    // Inject trusted identity headers derived from the verified session.
    requestHeaders.set("x-tagit-wallet", claims.sub);
    requestHeaders.set("x-tagit-account", claims.act);
    requestHeaders.set("x-tagit-role", claims.role);
    return allow();
  }

  // Protected path with no / invalid session.
  if (!isEnforcing()) {
    console.warn(
      `[auth] REPORT-ONLY: would deny ${req.method} ${pathname} (no valid tagit_session)`,
    );
    return allow();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Run on everything except framework static assets and the public files that
  // never need auth. The remaining allowlist is enforced in isPublicPath().
  matcher: ["/((?!_next/static|_next/image|favicon.ico|tagit_logo.png).*)"],
};
