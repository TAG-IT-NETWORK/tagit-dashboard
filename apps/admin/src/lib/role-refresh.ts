/**
 * Role-cache TTL policy for the session JWT (Week-B WB-02).
 *
 * The admin_users role is cached in the NextAuth JWT at sign-in. Pre-WB-02 it
 * only ever refreshed on a fresh sign-in or an explicit `update` trigger —
 * i.e. WITH the user's cooperation — so a demoted or deleted user kept their
 * old power for the whole session lifetime. This module is the pure decision
 * (unit-tested without next-auth): the `jwt` callback re-resolves the role
 * from tagit-services whenever the cached copy is older than ROLE_TTL_MS.
 *
 *   - demoted user   → loses the old role within 5 minutes, no cooperation
 *   - deleted user   → fetchAdminRole resolves null → no-role → /403 everywhere
 *   - absent/forged  roleFetchedAt (missing, non-number, in the future) is
 *     treated as stale — fail closed, refetch.
 */

/** Cached role max age before a server re-resolve (5 minutes). */
export const ROLE_TTL_MS = 5 * 60 * 1000;

/** Session/JWT lifetime, seconds (12 h) — auth.ts maxAge for both. */
export const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

/**
 * True when the cached role can no longer be trusted: never stamped, stamped
 * with garbage, stamped in the future (clock skew / forged claim), or older
 * than the TTL.
 */
export function roleIsStale(
  roleFetchedAt: unknown,
  now: number,
  ttlMs: number = ROLE_TTL_MS,
): boolean {
  if (typeof roleFetchedAt !== "number" || !Number.isFinite(roleFetchedAt)) return true;
  if (roleFetchedAt > now) return true;
  return now - roleFetchedAt >= ttlMs;
}

/**
 * The complete `jwt`-callback refresh decision. Fresh sign-ins and explicit
 * session updates (`useSession().update()` after /team edits) always refetch;
 * otherwise the TTL decides — the user cannot avoid the refresh by simply
 * never triggering an update.
 */
export function shouldRefreshRole(input: {
  /** An OAuth `account` rode in on the callback — first token mint. */
  freshSignIn: boolean;
  /** NextAuth jwt callback trigger ("update" = explicit re-fetch request). */
  trigger?: string;
  /** token.roleFetchedAt claim — untrusted, any shape. */
  roleFetchedAt: unknown;
  /** Current epoch ms. */
  now: number;
}): boolean {
  if (input.freshSignIn || input.trigger === "update") return true;
  return roleIsStale(input.roleFetchedAt, input.now);
}
