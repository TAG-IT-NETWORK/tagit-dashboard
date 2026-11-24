/**
 * How long the role and brand cached in the session may be trusted (TAP-T17).
 * Same rule as the TAG IT console.
 *
 * The roster role and brand are read at sign-in and kept in the session
 * token. They are read again whenever the copy is older than ROLE_TTL_MS, so
 * a person who is demoted, moved or removed loses the old access within five
 * minutes, with no action on their part. A missing, malformed or future
 * stamp counts as stale: fail closed, read again.
 */

/** Cached role max age before a server re-read (5 minutes). */
export const ROLE_TTL_MS = 5 * 60 * 1000;

/** Session and token lifetime, seconds (12 h). */
export const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

export function roleIsStale(
  roleFetchedAt: unknown,
  now: number,
  ttlMs: number = ROLE_TTL_MS,
): boolean {
  if (typeof roleFetchedAt !== "number" || !Number.isFinite(roleFetchedAt)) return true;
  if (roleFetchedAt > now) return true;
  return now - roleFetchedAt >= ttlMs;
}

/** A fresh sign-in or an explicit update always re-reads; otherwise the age decides. */
export function shouldRefreshRole(input: {
  freshSignIn: boolean;
  trigger?: string;
  roleFetchedAt: unknown;
  now: number;
}): boolean {
  if (input.freshSignIn || input.trigger === "update") return true;
  return roleIsStale(input.roleFetchedAt, input.now);
}
