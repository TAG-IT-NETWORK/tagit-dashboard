/**
 * Who may reach what in the brand app (TAP-T17). PURE logic only: no
 * next-auth, no fetch, no env, so the whole decision table is unit-tested.
 * src/middleware.ts is a thin adapter around {@link evaluateAccess}.
 *
 * The rule is default deny. A path is closed unless it is listed here:
 *
 *   OPEN_PREFIXES   reachable by anyone, and never touch the session at all
 *   PUBLIC_PAGES    the landing page and the sign-in page
 *   BRAND_PREFIXES  the app itself: a signed-in roster user WITH a brand
 *
 * A page or route added later is closed to everyone until it is listed.
 */

export const ROLES = ["viewer", "operator", "admin"] as const;
export type Role = (typeof ROLES)[number];

const ROLE_RANK: Record<Role, number> = { viewer: 0, operator: 1, admin: 2 };

/** Narrow an untrusted value (JWT claim, API body) to a Role. */
export function parseRole(value: unknown): Role | null {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value)
    ? (value as Role)
    : null;
}

/** True when `role` meets or exceeds `required` (viewer < operator < admin). */
export function hasRole(role: Role | null, required: Role): boolean {
  return role !== null && ROLE_RANK[role] >= ROLE_RANK[required];
}

/** Narrow an untrusted value to a brand id, or null. */
export function parseBrandId(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= 200 ? value : null;
}

// ── Path classification ──────────────────────────────────────────────────────

/**
 * Open to anyone, with or without a session, and decided BEFORE the session
 * is read, so these keep working even when sign-in is not configured:
 * - /api/auth          the sign-in handlers themselves
 * - /api/demo-request  the landing page's lead form (holds no services key)
 * - /no-access         where a refused sign-in lands
 *
 * A route that attaches the services key to a request must NEVER be listed
 * here: whoever can reach it borrows that key.
 */
const OPEN_PREFIXES = ["/api/auth", "/api/demo-request", "/no-access"] as const;

/** Exact paths a signed-out visitor may see. A brand session is sent home. */
const PUBLIC_PAGES = ["/", "/signin"] as const;

/** Everything a brand session may reach. */
const BRAND_PREFIXES = ["/home", "/products"] as const;

/** Where a brand session lands. */
export const BRAND_HOME = "/home";
export const SIGN_IN_PATH = "/signin";
export const NO_ACCESS_PATH = "/no-access";

/**
 * Minimum role per brand path: longest matching prefix wins, default viewer.
 * An entry may carry a METHOD list and then applies to those methods only;
 * when the caller cannot name the method, method-scoped entries still apply
 * (fail closed). Empty today: slice 1 has no writes.
 */
export const PATH_ROLES: ReadonlyArray<
  readonly [prefix: string, role: Role, methods?: readonly string[]]
> = [];

/** Prefix match on whole path segments: /home, /home/x, but not /homes. */
function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isOpenPath(pathname: string): boolean {
  return OPEN_PREFIXES.some((p) => matchesPrefix(pathname, p));
}

export function isPublicPage(pathname: string): boolean {
  return (PUBLIC_PAGES as readonly string[]).includes(pathname);
}

export function isBrandPath(pathname: string): boolean {
  return BRAND_PREFIXES.some((p) => matchesPrefix(pathname, p));
}

export function isApiPath(pathname: string): boolean {
  return matchesPrefix(pathname, "/api");
}

export function requiredRoleFor(pathname: string, method?: string): Role {
  const normalized = method?.toUpperCase();
  let best: { prefix: string; role: Role } | null = null;
  for (const [prefix, role, methods] of PATH_ROLES) {
    if (methods !== undefined && normalized !== undefined && !methods.includes(normalized)) {
      continue;
    }
    if (!matchesPrefix(pathname, prefix)) continue;
    if (best === null || prefix.length > best.prefix.length) best = { prefix, role };
  }
  return best?.role ?? "viewer";
}

// ── The decision ─────────────────────────────────────────────────────────────

export interface AccessSession {
  authenticated: boolean;
  role: Role | null;
  /** The roster user's brand id; null for TAG IT staff and unknown emails. */
  brand: string | null;
}

/** A session that may use the app: signed in, on the roster, with a brand. */
export function isBrandSession(session: AccessSession): boolean {
  return session.authenticated && session.role !== null && parseBrandId(session.brand) !== null;
}

export type AccessDecision = "allow" | "signin" | "no-access" | "home" | "forbidden";

/**
 * The complete decision, as a pure function:
 * - open path                              → allow
 * - landing or sign-in page                → allow, or home for a brand session
 * - no session                             → signin
 * - a session that is not a brand session  → no-access (staff, unknown email,
 *                                            someone removed from the roster:
 *                                            one answer for all of them)
 * - a path that is not listed              → home for a page, forbidden for an API
 * - role below what the path needs         → forbidden
 */
export function evaluateAccess(
  pathname: string,
  session: AccessSession,
  method?: string,
): AccessDecision {
  if (isOpenPath(pathname)) return "allow";
  const brand = isBrandSession(session);
  if (isPublicPage(pathname)) return brand ? "home" : "allow";
  if (!session.authenticated) return "signin";
  if (!brand) return "no-access";
  if (!isBrandPath(pathname)) return isApiPath(pathname) ? "forbidden" : "home";
  return hasRole(session.role, requiredRoleFor(pathname, method)) ? "allow" : "forbidden";
}

/**
 * The decision when sign-in is not configured on this deployment (a missing
 * secret). The session cannot be read, so nobody is signed in: the public
 * pages stay up and everything else is closed.
 */
export function evaluateWithoutAuth(pathname: string): "allow" | "closed" {
  return isOpenPath(pathname) || isPublicPage(pathname) ? "allow" : "closed";
}

// ── Where to go after sign-in ────────────────────────────────────────────────

/**
 * The page to open after sign-in. Only a path inside the app is accepted;
 * anything else (another site, a scheme, a path that is not listed, a
 * backslash trick) becomes the brand home.
 */
export function safeCallbackPath(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 500) return BRAND_HOME;
  if (!value.startsWith("/") || value.startsWith("//")) return BRAND_HOME;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    // No backslash, no control characters, no whitespace.
    if (code === 0x5c || code <= 0x20 || code === 0x7f) return BRAND_HOME;
  }
  const end = value.search(/[?#]/);
  const pathname = end === -1 ? value : value.slice(0, end);
  return isBrandPath(pathname) ? value : BRAND_HOME;
}

// ── Matcher mirror ───────────────────────────────────────────────────────────

/**
 * Mirror of the static `config.matcher` in src/middleware.ts. Next needs the
 * real one as an inline literal, so the two are kept in step by hand (the
 * unit tests pin both).
 *
 * Skipped: Next's own build files, and the files in /public by NAME. There is
 * deliberately no rule for "anything that ends like a file": a page address
 * can end in .png too, and it must meet the gate.
 */
export const GATE_MATCHER_RE =
  /^\/(?!_next\/static\/|_next\/image$|favicon\.ico$|tagit_logo\.png$).*/;

export function isGatedByMatcher(pathname: string): boolean {
  return GATE_MATCHER_RE.test(pathname);
}
