/**
 * Role-based access control for the admin dashboard (META-T32, REQ-S-16).
 *
 * PURE logic only — no next-auth, no fetch, no env — so the role map and the
 * middleware decision table are unit-testable without a request context.
 * src/middleware.ts is a thin adapter around {@link evaluateAccess}.
 *
 * Roles come from the tagit-services admin_users roster (resolved at Google
 * sign-in, cached in the session JWT):
 *
 *   viewer   — read-only: every page not escalated below
 *   operator — + catalog drafts, media, batches, binding
 *   admin    — + publish, prices, recovery, /team roster CRUD
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

// ── Path classification ──────────────────────────────────────────────────────

/**
 * Paths that bypass the session gate entirely. These either ARE the sign-in
 * surface or carry their own authentication and are called by non-browser
 * clients that can never hold a session cookie:
 * - /api/auth            NextAuth handlers + default sign-in pages
 * - /api/a2a             external A2A agents (A2A_API_KEY auth of its own)
 * - /api/farcaster-manifest  public manifest fetched by crawlers
 * - /api/ipfs            pre-T32 public pin passthrough (unchanged posture)
 */
const PUBLIC_PREFIXES = ["/api/auth", "/api/a2a", "/api/farcaster-manifest", "/api/ipfs"] as const;

/**
 * Signed-in but role-EXEMPT paths. /403 must render for a user whose email is
 * not enrolled in admin_users (role null) — gating it by role would loop the
 * redirect.
 */
const SESSION_ONLY_PATHS = ["/403"] as const;

/**
 * Minimum role per path prefix — LONGEST matching prefix wins, so
 * /catalog/publish (admin) escalates above /catalog (operator). Anything
 * unlisted needs only `viewer` (signed-in, read-only).
 *
 * Some prefixes are claimed ahead of the pages that will live there
 * (/batch, /bind, /prices, /recovery ship in sibling META-P2 tasks): the
 * middleware contract is established here so those pages land pre-gated.
 *
 * /catalog (META-T33) and /assets (META-T36) READ pages are deliberately
 * viewer-level (unlisted): their UIs render read-only for viewers. Catalog
 * WRITES all go through /api/catalog-proxy, whose mutating routes re-check
 * the session role server-side (operator+ via canMutateCatalog; publish is
 * admin-only via canPublishCatalog) — the path map cannot see HTTP methods,
 * so the write/read split is enforced in the proxies.
 *
 * A `*` prefix segment matches exactly ONE path segment — needed for the
 * T34 batch action routes whose id sits mid-path
 * (/api/catalog-proxy/batches/bat_…/execute). GET-only read routes on the
 * same rails (/batches list+status, /binding/exceptions, /export.csv) stay
 * viewer-level on purpose: the wizard/station pages render read-only for
 * viewers, and every mutating route ALSO re-checks the role server-side.
 */
export const PATH_ROLES: ReadonlyArray<readonly [prefix: string, role: Role]> = [
  // operator — drafts + media + batches + binding
  ["/assets/new", "operator"],
  ["/assembly-line", "operator"],
  ["/batch", "operator"],
  ["/bind", "operator"],
  ["/api/media-proxy", "operator"],
  ["/api/mint-proxy", "operator"],
  // operator — T34 batch execute + T35 binding writes
  ["/api/catalog-proxy/batches/*/execute", "operator"],
  ["/api/catalog-proxy/binding/bind", "operator"],
  ["/api/catalog-proxy/binding/verify", "operator"],
  ["/api/catalog-proxy/binding/reassign", "operator"],
  ["/api/catalog-proxy/binding/skip-defective", "operator"],
  // admin — publish + prices + recovery + team
  ["/catalog/publish", "admin"],
  ["/publish", "admin"],
  ["/prices", "admin"],
  ["/pricing", "admin"],
  ["/recovery", "admin"],
  ["/resolve", "admin"],
  ["/team", "admin"],
  ["/api/team-proxy", "admin"],
  // admin — T34 unstick (force-resets server state) + T35 void-remint
  // (irreversible on-chain recycle)
  ["/api/catalog-proxy/batches/*/unstick", "admin"],
  ["/api/catalog-proxy/binding/void-remint", "admin"],
];

/**
 * Prefix match on whole path segments: /team, /team/x — but not /teammates.
 * A `*` segment in the prefix matches exactly one non-empty path segment.
 */
function matchesPrefix(pathname: string, prefix: string): boolean {
  if (!prefix.includes("*")) {
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  }
  const want = prefix.split("/");
  const got = pathname.split("/");
  if (got.length < want.length) return false;
  return want.every((seg, i) => (seg === "*" ? got[i].length > 0 : got[i] === seg));
}

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => matchesPrefix(pathname, p));
}

export function isSessionOnlyPath(pathname: string): boolean {
  return SESSION_ONLY_PATHS.some((p) => matchesPrefix(pathname, p));
}

export function isApiPath(pathname: string): boolean {
  return matchesPrefix(pathname, "/api");
}

/** Minimum role required for a path (longest matching prefix, default viewer). */
export function requiredRoleFor(pathname: string): Role {
  let best: { prefix: string; role: Role } | null = null;
  for (const [prefix, role] of PATH_ROLES) {
    if (!matchesPrefix(pathname, prefix)) continue;
    if (best === null || prefix.length > best.prefix.length) best = { prefix, role };
  }
  return best?.role ?? "viewer";
}

// ── Middleware decision table ────────────────────────────────────────────────

export type AccessDecision = "allow" | "signin" | "forbidden";

/**
 * The complete middleware decision, as a pure function:
 * - public path                → allow
 * - no session                 → signin   (redirect / 401 for APIs)
 * - /403 itself                → allow    (any signed-in user, even role-less)
 * - role below the path's need → forbidden (redirect to /403 / 403 for APIs)
 */
export function evaluateAccess(
  pathname: string,
  session: { authenticated: boolean; role: Role | null },
): AccessDecision {
  if (isPublicPath(pathname)) return "allow";
  if (!session.authenticated) return "signin";
  if (isSessionOnlyPath(pathname)) return "allow";
  return hasRole(session.role, requiredRoleFor(pathname)) ? "allow" : "forbidden";
}

// ── Matcher mirror ───────────────────────────────────────────────────────────

/**
 * Mirror of the static `config.matcher` regex in src/middleware.ts — Next.js
 * requires the real matcher to be an inline literal, so the two MUST be kept
 * in sync by hand (the rbac unit tests pin this one). Excluded: Next
 * internals and static assets served from /public.
 */
export const GATE_MATCHER_RE =
  /^\/(?!_next\/static|_next\/image|favicon\.ico|.*\.(?:png|jpg|jpeg|svg|gif|webp|ico|txt|xml|map)$).*/;

/** True when the middleware matcher would run the gate for this path. */
export function isGatedByMatcher(pathname: string): boolean {
  return GATE_MATCHER_RE.test(pathname);
}
