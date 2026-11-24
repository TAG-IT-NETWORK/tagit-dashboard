/**
 * Is sign-in configured on this deployment? (TAP-T17)
 *
 * Without the session secret the session cannot be read at all, and asking
 * for it fails the request. The middleware checks this first so that a
 * deployment with no sign-in settings still serves the landing page and
 * keeps everything else closed, instead of failing every page.
 */
export function authConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return [env.AUTH_SECRET, env.AUTH_GOOGLE_ID, env.AUTH_GOOGLE_SECRET].every(
    (v) => typeof v === "string" && v.length > 0,
  );
}
