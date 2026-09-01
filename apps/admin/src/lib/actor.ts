import { auth } from "@/auth";
import { E2E_ACTOR, isE2EAuthBypass } from "@/lib/e2e-auth";

/**
 * Signed-in dashboard identity for server proxies (META-T32, REQ-S-16).
 *
 * Every MUTATING proxy forwards the acting human as the X-Actor header so the
 * tagit-services audit log names a person, not "api-key" (services reads it
 * in src/lib/tenant.ts tenantCtx). Usage inside a route handler:
 *
 *   const actor = await getActor();
 *   headers: { ...authHeaders, ...actorHeader(actor) }
 */

/** Lowercase session email, or null outside a signed-in request context. */
export async function getActor(): Promise<string | null> {
  // CI-only Playwright seam (dead in production builds) — see lib/e2e-auth.ts.
  if (isE2EAuthBypass()) return E2E_ACTOR;
  try {
    const session = await auth();
    const email = session?.user?.email;
    return typeof email === "string" && email.length > 0 ? email.toLowerCase() : null;
  } catch {
    // Outside a request scope (build-time render, unit tests): no actor.
    return null;
  }
}

/** Spreadable X-Actor header fragment — empty when there is no actor. */
export function actorHeader(actor: string | null): Record<string, string> {
  return actor ? { "x-actor": actor } : {};
}
