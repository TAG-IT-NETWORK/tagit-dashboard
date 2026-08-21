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
 * (/catalog, /batch, /bind, /prices, /recovery ship in sibling META-P2
 * tasks): the middleware contract is established here so those pages land
 * pre-gated.
 */
export const PATH_ROLES: ReadonlyArray<readonly [prefix: string, role: Role]> = [
  // operator — drafts + media + batches + binding
  ["/catalog", "operator"],
  ["/assets/new", "operator"],
  ["/assembly-line", "operator"],
  ["/batch", "operator"],
  ["/bind", "operator"],
  ["/api/media-proxy", "operator"],
  ["/api/mint-proxy", "operator"],
  // admin — publish + prices + recovery + team
  ["/catalog/publish", "admin"],
  ["/publish", "admin"],
  ["/prices", "admin"],
  ["/pricing", "admin"],
  ["/recovery", "admin"],
  ["/resolve", "admin"],
  ["/team", "admin"],
  ["/api/team-proxy", "admin"],
];

/** Prefix match on whole path segments: /team, /team/x — but not /teammates. */
function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
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
