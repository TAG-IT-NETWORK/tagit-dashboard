import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

import { auth } from "@/auth";
import {
  BRAND_HOME,
  NO_ACCESS_PATH,
  SIGN_IN_PATH,
  evaluateAccess,
  evaluateWithoutAuth,
  isApiPath,
  isOpenPath,
  parseBrandId,
  parseRole,
} from "@/lib/access";
import { authConfigured } from "@/lib/auth-config";

/**
 * The gate in front of every page and route of the brand app (TAP-T17).
 *
 * The decision is the pure evaluateAccess in src/lib/access.ts (unit-tested
 * there). This file only turns a decision into an answer:
 *
 *   signin     page: to the sign-in page, remembering where they were going
 *              API:  401
 *   no-access  page: to /no-access          API: 403
 *   home       to the brand home
 *   forbidden  page: to the brand home      API: 403
 *
 * Open paths are answered before the session is read. When sign-in is not
 * configured the session cannot be read at all: the public pages stay up
 * and everything else is closed.
 *
 * This is the first gate, not the only one: the brand pages read the session
 * again on the server, and tagit-services checks the brand on every call.
 */
function json(status: number, error: string): NextResponse {
  return NextResponse.json({ ok: false, error }, { status });
}

const gate = auth((req) => {
  const { pathname, search, origin } = req.nextUrl;
  const user = req.auth?.user;
  const decision = evaluateAccess(
    pathname,
    {
      authenticated: req.auth !== null && req.auth !== undefined,
      role: parseRole(user?.role),
      brand: parseBrandId(user?.businessId),
    },
    req.method,
  );
  const api = isApiPath(pathname);

  switch (decision) {
    case "allow":
      return NextResponse.next();
    case "home":
      return NextResponse.redirect(new URL(BRAND_HOME, origin));
    case "signin": {
      if (api) return json(401, "UNAUTHENTICATED");
      const url = new URL(SIGN_IN_PATH, origin);
      url.searchParams.set("callbackUrl", `${pathname}${search}`);
      return NextResponse.redirect(url);
    }
    case "no-access":
      return api ? json(403, "FORBIDDEN") : NextResponse.redirect(new URL(NO_ACCESS_PATH, origin));
    default:
      return api ? json(403, "FORBIDDEN") : NextResponse.redirect(new URL(BRAND_HOME, origin));
  }
});

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  const { pathname, origin } = req.nextUrl;
  if (isOpenPath(pathname)) return NextResponse.next();
  if (!authConfigured()) {
    if (evaluateWithoutAuth(pathname) === "allow") return NextResponse.next();
    return isApiPath(pathname)
      ? json(503, "SIGN_IN_NOT_CONFIGURED")
      : NextResponse.redirect(new URL("/", origin));
  }
  return (gate as unknown as (r: NextRequest, e: NextFetchEvent) => Promise<Response>)(req, event);
}

export const config = {
  // MUST stay an inline literal (Next reads it statically). Mirrored by
  // GATE_MATCHER_RE in src/lib/access.ts; the unit tests pin that one.
  //
  // Skipped: Next's own build files, and the files in /public BY NAME. There
  // is no "anything that ends in .png" rule: a page address can end like a
  // file too (a page with an id in it, opened as /…/x.png), and that must
  // meet the gate. A file added to /public is gated until it is named here; the
  // unit tests fail until it is.
  matcher: ["/((?!_next/static/|_next/image$|favicon\\.ico$|tagit_logo\\.png$).*)"],
};
