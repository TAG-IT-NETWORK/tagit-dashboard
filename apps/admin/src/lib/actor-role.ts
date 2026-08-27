import { auth } from "@/auth";
import { parseRole, type Role } from "@/lib/rbac";
import type { CatalogRole } from "@/lib/catalog/template-logic";

/**
 * Role half of the REQ-S-16 actor seam (see lib/actor.ts).
 *
 * META-T32 landed: the admin session (NextAuth JWT) carries the admin_users
 * roster role, so this is now the single place that maps the dashboard Role
 * onto the catalog surface's CatalogRole:
 *
 *   admin    → "admin"   (may publish)
 *   operator → "editor"  (may edit drafts / media / overrides)
 *   viewer   → "viewer"  (read-only)
 *   null     → null      (unauthenticated or not enrolled — read-only,
 *                         fail closed; see canMutateCatalog)
 *
 * The middleware already 401/403s role-less requests before they reach the
 * catalog proxies; the proxies re-check via this helper (defense in depth).
 */
const CATALOG_ROLE_BY_ROLE: Record<Role, CatalogRole> = {
  admin: "admin",
  operator: "editor",
  viewer: "viewer",
};

export async function getActorRole(): Promise<CatalogRole | null> {
  try {
    const session = await auth();
    const role = parseRole(session?.user?.role);
    return role === null ? null : CATALOG_ROLE_BY_ROLE[role];
  } catch {
    // Outside a request scope (build-time render, unit tests): no role.
    return null;
  }
}
