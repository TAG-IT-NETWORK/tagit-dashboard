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
 * Paths that bypass the session gate entirely. Only two things qualify: the
 * sign-in surface itself, and a public document that holds no key and reads
 * nothing private.
 * - /api/auth                NextAuth handlers + default sign-in pages
 * - /api/farcaster-manifest  public manifest fetched by crawlers
 *
 * A route that attaches a server-side key to a request must NEVER be listed
 * here (TAP-T02): whoever can reach it borrows that key.
 */
const PUBLIC_PREFIXES = ["/api/auth", "/api/farcaster-manifest"] as const;

/**
 * BRAND sessions are closed out of this console (TAP-T17, slice 3). A brand
 * user is a roster user with a business id. Brands have their own app at
 * {@link BRAND_APP_URL}; this console is for TAG IT staff only. A brand
 * session can sign in here but reaches nothing except /403, which points it
 * to the brand app. There is no allow-list any more: nothing a page or proxy
 * adds later can open to a brand session by accident.
 *
 * Staff still work FOR a brand by choosing it on /brands (TAP-T16); that is
 * a platform session and is not affected.
 */
export const BRAND_APP_URL = "https://pro.tagit.network";

/**
 * Signed-in but role-EXEMPT paths. /403 must render for a user whose email is
 * not enrolled in admin_users (role null) — gating it by role would loop the
 * redirect.
 */
const SESSION_ONLY_PATHS = ["/403"] as const;

/**
 * Minimum role per path prefix — LONGEST matching prefix wins, so
 * /api/catalog-proxy/templates/*\/publish (admin) escalates above the
 * templates prefix (operator writes). Anything unlisted needs only `viewer`
 * (signed-in, read-only).
 *
 * Some prefixes are claimed ahead of the pages that will live there
 * (/batch, /bind, /prices, /recovery ship in sibling META-P2 tasks): the
 * middleware contract is established here so those pages land pre-gated.
 *
 * /catalog (META-T33) and /assets (META-T36) READ pages are deliberately
 * viewer-level (unlisted): their UIs render read-only for viewers.
 *
 * WB-06: an entry may carry an optional METHOD list — it then applies only
 * to those HTTP methods, which lets the template create/update writes
 * (POST /api/catalog-proxy/templates, PUT /api/catalog-proxy/templates/:id)
 * be pinned at operator while the GET list/detail on the same paths stays
 * viewer-level. When the caller cannot supply a method the method-scoped
 * entries still apply (fail closed). Every mutating proxy ALSO re-checks the
 * role server-side (defense in depth).
 *
 * A `*` prefix segment matches exactly ONE path segment — needed for the
 * T34 batch action routes whose id sits mid-path
 * (/api/catalog-proxy/batches/bat_…/execute). GET-only read routes on the
 * same rails (/batches list+status, /binding/exceptions, /export.csv,
 * /templates/*\/items) stay viewer-level on purpose: the wizard/station
 * pages render read-only for viewers.
 */
export const PATH_ROLES: ReadonlyArray<
  readonly [prefix: string, role: Role, methods?: readonly string[]]
> = [
  // operator — drafts + media + batches + binding
  ["/assets/new", "operator"],
  ["/assembly-line", "operator"],
  ["/batch", "operator"],
  ["/bind", "operator"],
  ["/api/media-proxy", "operator"],
  ["/api/mint-proxy", "operator"],
  // operator — T33 template create/update (WB-06, method-scoped: the GET
  // list/detail on the same paths stays viewer-level)
  ["/api/catalog-proxy/templates", "operator", ["POST"]],
  ["/api/catalog-proxy/templates/*", "operator", ["PUT"]],
  // operator — T34 batch execute + T35 binding writes
  ["/api/catalog-proxy/batches/*/execute", "operator"],
  ["/api/catalog-proxy/binding/bind", "operator"],
  ["/api/catalog-proxy/binding/verify", "operator"],
  ["/api/catalog-proxy/binding/reassign", "operator"],
  ["/api/catalog-proxy/binding/skip-defective", "operator"],
  ["/api/catalog-proxy/binding/activate", "operator"],
  ["/api/catalog-proxy/lifecycle/flag", "operator"],
  ["/api/catalog-proxy/assets/*/price", "operator", ["PUT"]],
  // admin — publish + prices + recovery + team
  ["/publish", "admin"],
  ["/prices", "admin"],
  ["/pricing", "admin"],
  ["/recovery", "admin"],
  ["/resolve", "admin"],
  ["/team", "admin"],
  ["/api/team-proxy", "admin"],
  // admin — brand records and "create for a brand" (TAP-T16). A brand
  // session cannot reach either, whatever its role (it reaches nothing).
  ["/brands", "admin"],
  ["/api/brand-proxy", "admin"],
  // admin — T33 template lifecycle verbs (WB-06): publish snapshots a live
  // version, archive retires it, propagate relayer-broadcasts re-renders
  ["/api/catalog-proxy/templates/*/publish", "admin"],
  ["/api/catalog-proxy/templates/*/archive", "admin"],
  ["/api/catalog-proxy/templates/*/propagate", "admin"],
  // admin — T34 unstick (force-resets server state) + T35 void-remint
  // (irreversible on-chain recycle)
  ["/api/catalog-proxy/batches/*/unstick", "admin"],
  ["/api/catalog-proxy/binding/void-remint", "admin"],
  ["/api/catalog-proxy/lifecycle/recycle", "admin"],
  ["/api/catalog-proxy/lifecycle/resolve", "admin"],
  ["/api/catalog-proxy/sale/settle", "admin"],
  ["/api/catalog-proxy/ratings/*", "admin", ["PUT"]],
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

/**
 * Read a business id from an untrusted place (a roster answer, a JWT claim).
 * - null or absent        → valid, no brand: a staff account
 * - a non-empty string    → valid, that brand
 * - anything else         → NOT valid (a number, "", an object, a list, a
 *                           string too long to be an id)
 *
 * A claim that is not valid must never be read as "no brand": that would
 * turn a broken brand record into a staff account. Callers drop the role
 * instead, so the account can do nothing.
 */
export function readBusinessClaim(
  raw: unknown,
): { valid: true; businessId: string | null } | { valid: false } {
  if (raw === null || raw === undefined) return { valid: true, businessId: null };
  if (typeof raw === "string" && raw.length > 0 && raw.length <= 200) {
    return { valid: true, businessId: raw };
  }
  return { valid: false };
}

/**
 * True when a session's business id marks it as a brand session. Anything
 * that is not null/undefined/"" counts: a value of an unexpected type is
 * treated as a brand (closed), never as staff.
 */
export function isBrandTenant(tenant: unknown): boolean {
  return tenant !== null && tenant !== undefined && tenant !== "";
}

export function isApiPath(pathname: string): boolean {
  return matchesPrefix(pathname, "/api");
}

/**
 * Minimum role required for a path (longest matching prefix, default viewer).
 * Method-scoped entries (WB-06) apply only when `method` matches — or always
 * when the caller omits the method (fail closed: an unknown method must be
 * assumed to be the gated one).
 */
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

// ── Middleware decision table ────────────────────────────────────────────────

export type AccessDecision = "allow" | "signin" | "forbidden";

/**
 * The complete middleware decision, as a pure function:
 * - public path                    → allow
 * - no session                     → signin   (redirect / 401 for APIs)
 * - /403 itself                    → allow    (any signed-in user, even role-less)
 * - brand session, anything else   → forbidden (whatever its role or the path)
 * - role below the path's need     → forbidden (redirect to /403 / 403 for APIs)
 *
 * `tenant` is the session's business id: a non-empty string for a brand
 * user, null/undefined for a platform user (TAP-T02).
 *
 * `method` feeds the WB-06 method-scoped entries; omitting it treats every
 * method-scoped entry as applicable (fail closed).
 */
export function evaluateAccess(
  pathname: string,
  session: { authenticated: boolean; role: Role | null; tenant?: unknown },
  method?: string,
): AccessDecision {
  if (isPublicPath(pathname)) return "allow";
  if (!session.authenticated) return "signin";
  if (isSessionOnlyPath(pathname)) return "allow";
  // Any business id closes the console, before any role rule.
  if (isBrandTenant(session.tenant)) return "forbidden";
  return hasRole(session.role, requiredRoleFor(pathname, method)) ? "allow" : "forbidden";
}

// ── Matcher mirror ───────────────────────────────────────────────────────────

/**
 * Mirror of the static `config.matcher` regex in src/middleware.ts — Next.js
 * requires the real matcher to be an inline literal, so the two MUST be kept
 * in sync by hand (the rbac unit tests pin both).
 *
 * Skipped: Next's own build files, and the files in /public by NAME. There is
 * deliberately no rule for "anything that ends like a file": a page address
 * can end in .png too (/assets/x.png is the assets/[id] page), and it must
 * meet the gate. This also covers WB-08: nothing under /api/ is ever skipped.
 */
export const GATE_MATCHER_RE =
  /^\/(?!_next\/static\/|_next\/image$|favicon\.ico$|tagit_logo\.png$).*/;

/** True when the middleware matcher would run the gate for this path. */
export function isGatedByMatcher(pathname: string): boolean {
  return GATE_MATCHER_RE.test(pathname);
}
