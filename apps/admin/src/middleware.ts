import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { isE2EAuthBypass } from "@/lib/e2e-auth";
import { evaluateAccess, isApiPath, parseRole } from "@/lib/rbac";

/**
 * Session + role gate for every admin route (META-T32). This replaces the
 * retired SITE_PASSWORD shared-secret gate.
 *
 * The decision itself is the pure {@link evaluateAccess} in src/lib/rbac.ts
 * (unit-tested there); this file only translates decisions into transport:
 *
 *   signin    → pages: redirect to the NextAuth sign-in (callbackUrl back)
 *               APIs:  401 JSON (a proxy caller can't follow a redirect)
 *   forbidden → pages: redirect to /403
 *               APIs:  403 JSON
 *
 * Defense in depth: the key-holding proxies ALSO re-check the session
 * server-side (see /api/team-proxy) — the middleware is the first gate, not
 * the only one.
 */
export default auth((req) => {
  // CI-only Playwright seam (dead in production builds) — see lib/e2e-auth.ts.
  if (isE2EAuthBypass()) return NextResponse.next();

  const { pathname, search } = req.nextUrl;
  const decision = evaluateAccess(
    pathname,
    {
      authenticated: req.auth !== null && req.auth !== undefined,
      role: parseRole(req.auth?.user?.role),
    },
    // WB-06: method-scoped PATH_ROLES entries (template create/update).
    req.method,
  );

  if (decision === "allow") return NextResponse.next();

  if (decision === "signin") {
    if (isApiPath(pathname)) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    const signInUrl = new URL("/api/auth/signin", req.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(signInUrl);
  }

  // forbidden
  if (isApiPath(pathname)) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }
  return NextResponse.redirect(new URL("/403", req.nextUrl.origin));
});

export const config = {
  // MUST stay an inline literal (Next parses it statically). Mirrored by
  // GATE_MATCHER_RE in src/lib/rbac.ts — keep the two in sync (pinned by the
  // rbac unit tests). Skips Next internals and /public static assets — but
  // the static-extension exclusion does NOT apply under /api/ (WB-08):
  // /api/team-proxy/foo.png must hit the gate like any other API call.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|(?!api/).*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|txt|xml|map)$).*)",
  ],
};
