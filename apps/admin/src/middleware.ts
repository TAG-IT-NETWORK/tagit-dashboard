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
 * A brand session (one with a business id) reaches nothing here but /403,
 * which points it to the brand app (TAP-T17, see src/lib/rbac.ts).
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
      // The session already drops the role when the business id cannot be
      // read (lib/admin-role.ts); the rule below closes on an odd value too.
      tenant: req.auth?.user?.businessId as unknown,
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
  // rbac unit tests).
  //
  // Skipped: Next's own build files, and the files in /public BY NAME. There
  // is no "anything that ends in .png" rule: a page address can end like a
  // file too (/assets/x.png is the assets/[id] page), and that must meet the
  // gate. A file added to /public is gated until it is named here; the rbac
  // unit tests fail until it is.
  matcher: ["/((?!_next/static/|_next/image$|favicon\\.ico$|tagit_logo\\.png$).*)"],
};
