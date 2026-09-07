import { parseRole, type Role } from "@/lib/rbac";

/**
 * Server-side role lookup against the tagit-services admin_users roster
 * (META-T32): GET {SERVICES_URL}/api/v1/admin/users/by-email/:email with the
 * admin API key injected SERVER-SIDE — same key-custody pattern as
 * media-proxy/mint-proxy; the key never reaches the browser and the browser
 * never calls services directly.
 *
 * Called from the NextAuth `jwt` callback at sign-in (and on session update),
 * so the resolved role is cached in the session JWT — page loads do NOT hit
 * services.
 *
 * Fail-closed: any failure (missing key, 404 unenrolled, malformed body,
 * network error) resolves `null`, which the middleware treats as
 * no-access → /403.
 */

const DEFAULT_SERVICES_URL = "https://api.tagit.network";

/** Pure response → role mapping (unit-tested without fetch). */
export function parseRoleResponse(status: number, body: unknown): Role | null {
  if (status !== 200 || typeof body !== "object" || body === null) return null;
  const record = body as { ok?: unknown; user?: { role?: unknown } };
  if (record.ok !== true) return null;
  return parseRole(record.user?.role);
}

export interface RosterIdentity {
  role: Role | null;
  /** Tenant scope from the roster row; null for platform users or unknown. */
  businessId: string | null;
}

/** Pure response → role + tenant mapping (unit-tested without fetch). */
export function parseRosterResponse(status: number, body: unknown): RosterIdentity {
  const role = parseRoleResponse(status, body);
  if (role === null) return { role: null, businessId: null };
  const record = body as { user?: { businessId?: unknown } };
  const raw = record.user?.businessId;
  return { role, businessId: typeof raw === "string" && raw.length > 0 ? raw : null };
}

/**
 * Roster lookup returning role AND business scope. The scope rides in the
 * session JWT next to the role so every services call the console makes on
 * behalf of a brand user carries X-Business-Id (tenant isolation).
 */
export async function fetchAdminRoster(email: string): Promise<RosterIdentity> {
  const apiKey = process.env.SERVICES_API_KEY;
  if (!apiKey) return { role: null, businessId: null };
  const servicesUrl = process.env.SERVICES_URL || DEFAULT_SERVICES_URL;
  const canonical = email.trim().toLowerCase();
  if (!canonical) return { role: null, businessId: null };
  try {
    const res = await fetch(
      `${servicesUrl}/api/v1/admin/users/by-email/${encodeURIComponent(canonical)}`,
      { headers: { authorization: `Bearer ${apiKey}` }, cache: "no-store" },
    );
    const body: unknown = await res.json().catch(() => null);
    return parseRosterResponse(res.status, body);
  } catch {
    return { role: null, businessId: null };
  }
}

export async function fetchAdminRole(email: string): Promise<Role | null> {
  const apiKey = process.env.SERVICES_API_KEY;
  if (!apiKey) return null;
  const servicesUrl = process.env.SERVICES_URL || DEFAULT_SERVICES_URL;
  const canonical = email.trim().toLowerCase();
  if (!canonical) return null;

  try {
    const res = await fetch(
      `${servicesUrl}/api/v1/admin/users/by-email/${encodeURIComponent(canonical)}`,
      { headers: { authorization: `Bearer ${apiKey}` }, cache: "no-store" },
    );
    const body: unknown = await res.json().catch(() => null);
    return parseRoleResponse(res.status, body);
  } catch {
    return null;
  }
}
