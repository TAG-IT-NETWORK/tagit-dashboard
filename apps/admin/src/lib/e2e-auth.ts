/**
 * E2E auth-bypass seam (CI only).
 *
 * The Playwright suite boots `next dev` with no Google OAuth and no session
 * cookie, so every page would bounce to /api/auth/signin (and, with no
 * AUTH_SECRET, the readiness probe 500s — the webServer timeout that broke
 * the E2E job after META-T32 landed auth). The suite instead sets
 * E2E_AUTH_BYPASS=true (playwright.config.ts webServer env) and the three
 * session chokepoints (middleware, getActorRole, getActor) short-circuit to
 * a signed-in admin.
 *
 * Safety — the seam is DOUBLE-gated:
 *   - server-only env var (NOT NEXT_PUBLIC_*): unreachable from the client;
 *   - dead in production builds regardless of env (NODE_ENV check), so a
 *     leaked var on Vercel changes nothing — prod always runs `next build`.
 */
export function isE2EAuthBypass(): boolean {
  return process.env.E2E_AUTH_BYPASS === "true" && process.env.NODE_ENV !== "production";
}

/** Actor identity stamped into X-Actor / audit logs by the bypass session. */
export const E2E_ACTOR = "e2e-bypass@tagit.local";
