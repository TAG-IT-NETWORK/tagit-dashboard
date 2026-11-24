/**
 * "Create for a brand" (TAP-T16): a platform admin picks a brand and the
 * console then talks to tagit-services as that brand, so the templates and
 * batches they make carry it. PURE logic only, like rbac.ts.
 *
 * The choice lives in a cookie. A cookie is the visitor's own to edit, so
 * nothing here trusts it by itself:
 *
 * - A BRAND session never reads it. Its business comes from the roster, and
 *   no cookie can change it (so a brand user cannot switch to another brand).
 * - It counts only for a signed-in PLATFORM ADMIN. For anyone else it is as if
 *   it were not there.
 * - It can only NARROW. A platform admin already reaches every brand; acting
 *   for one makes services show and stamp that one. It grants nothing.
 * - tagit-services still checks that the brand exists before anything is
 *   created under it.
 */

import { hasRole, type Role } from "./rbac";

export const ACTING_BRAND_COOKIE = "tagit_acting_brand";

/** Eight hours: one working session. Acting for a brand should not outlive the day. */
export const ACTING_BRAND_MAX_AGE_SECONDS = 8 * 60 * 60;

/**
 * A business id as it may travel in the cookie and the header: what
 * tagit-services accepts for a brand's id, plus the looser ids that existed
 * before brands had records. Never anything that could break out of a header.
 */
const BUSINESS_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;

export function parseBusinessId(value: unknown): string | null {
  return typeof value === "string" && BUSINESS_ID.test(value) ? value : null;
}

export interface TenantInput {
  /** The business id on the signed-in roster user, if any. */
  sessionBusinessId: string | null;
  role: Role | null;
  /** The raw cookie value, if any. */
  actingCookie: string | null | undefined;
}

export interface ResolvedTenant {
  /** The business id every services call is made under, or null for the whole platform. */
  tenant: string | null;
  /** True when `tenant` is a brand a platform admin CHOSE (not the session's own). */
  acting: boolean;
}

/** True for a signed-in admin with no business of their own. */
export function isPlatformAdmin(role: Role | null, sessionBusinessId: string | null): boolean {
  return sessionBusinessId === null && hasRole(role, "admin");
}

export function resolveTenant(input: TenantInput): ResolvedTenant {
  if (input.sessionBusinessId !== null) {
    return { tenant: input.sessionBusinessId, acting: false };
  }
  if (!isPlatformAdmin(input.role, null)) return { tenant: null, acting: false };
  const chosen = parseBusinessId(input.actingCookie);
  return chosen ? { tenant: chosen, acting: true } : { tenant: null, acting: false };
}
