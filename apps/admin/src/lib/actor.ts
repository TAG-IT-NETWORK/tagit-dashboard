import { cookies } from "next/headers";

import { auth } from "@/auth";
import { ACTING_BRAND_COOKIE, resolveTenant, type ResolvedTenant } from "@/lib/acting-brand";
import { E2E_ACTOR, isE2EAuthBypass } from "@/lib/e2e-auth";
import { parseRole } from "@/lib/rbac";

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

/**
 * The business id on the signed-in roster user, or null for platform
 * (unscoped) users and outside a request. This is WHO THE USER IS: it decides
 * the menu and what a brand session may reach. For what a services call is
 * made under, use {@link getTenant}.
 */
export async function getSessionTenant(): Promise<string | null> {
  if (isE2EAuthBypass()) return null;
  try {
    const session = await auth();
    const id = session?.user?.businessId;
    return typeof id === "string" && id.length > 0 ? id : null;
  } catch {
    return null;
  }
}

/**
 * The business every services call is made under, and whether a platform
 * admin chose it (TAP-T16, see lib/acting-brand.ts). A brand user's business
 * always wins; the chosen brand counts for a platform admin only.
 */
export async function getTenantContext(): Promise<ResolvedTenant> {
  if (isE2EAuthBypass()) return { tenant: null, acting: false };
  try {
    const session = await auth();
    const id = session?.user?.businessId;
    const sessionBusinessId = typeof id === "string" && id.length > 0 ? id : null;
    let actingCookie: string | undefined;
    try {
      actingCookie = (await cookies()).get(ACTING_BRAND_COOKIE)?.value;
    } catch {
      // Outside a request scope there is no cookie to read.
    }
    return resolveTenant({
      sessionBusinessId,
      role: parseRole(session?.user?.role),
      actingCookie,
    });
  } catch {
    return { tenant: null, acting: false };
  }
}

/**
 * Tenant half of the actor seam: the business id every services call made on
 * this user's behalf must carry as X-Business-Id — services then scopes
 * catalog, batches, binding, listings and the roster to that business
 * (tagit-services src/lib/tenant.ts). For a brand user it is their business;
 * for a platform admin acting for a brand it is that brand; otherwise null.
 */
export async function getTenant(): Promise<string | null> {
  return (await getTenantContext()).tenant;
}

export function tenantHeader(tenant: string | null): Record<string, string> {
  return tenant ? { "x-business-id": tenant } : {};
}
