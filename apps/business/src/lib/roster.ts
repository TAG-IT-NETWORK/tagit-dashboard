import { parseBrandId, parseRole, type Role } from "@/lib/access";

/**
 * Who a signed-in email is, read from the tagit-services team roster
 * (TAP-T17). SERVER ONLY: the services key is attached here and never
 * reaches the browser.
 *
 * Fail closed: a missing key, an unknown email, a malformed answer or a
 * network error all resolve to "nobody" (role null, brand null).
 */

const DEFAULT_SERVICES_URL = "https://api.tagit.network";
const ROSTER_TIMEOUT_MS = 8000;

export interface RosterIdentity {
  role: Role | null;
  /** The roster row's brand; null for TAG IT staff and for unknown emails. */
  brand: string | null;
}

export const NOBODY: RosterIdentity = { role: null, brand: null };

/** Pure answer → identity mapping (unit-tested without fetch). */
export function parseRosterResponse(status: number, body: unknown): RosterIdentity {
  if (status !== 200 || typeof body !== "object" || body === null) return NOBODY;
  const record = body as { ok?: unknown; user?: { role?: unknown; businessId?: unknown } };
  if (record.ok !== true) return NOBODY;
  const role = parseRole(record.user?.role);
  if (role === null) return NOBODY;
  return { role, brand: parseBrandId(record.user?.businessId) };
}

/**
 * True only for a roster user who belongs to a brand. TAG IT staff (a role
 * but no brand) and unknown emails are both false: this app is not for them,
 * and they get the same answer.
 */
export function isBrandIdentity(identity: RosterIdentity): boolean {
  return identity.role !== null && identity.brand !== null;
}

/** The email as the roster stores it, or null when there is none to look up. */
export function canonicalEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length >= 3 && email.length <= 320 ? email : null;
}

export async function fetchRoster(emailInput: unknown): Promise<RosterIdentity> {
  const apiKey = process.env.SERVICES_API_KEY;
  const email = canonicalEmail(emailInput);
  if (!apiKey || !email) return NOBODY;
  const servicesUrl = process.env.SERVICES_URL || DEFAULT_SERVICES_URL;
  try {
    const res = await fetch(
      `${servicesUrl}/api/v1/admin/users/by-email/${encodeURIComponent(email)}`,
      {
        headers: { authorization: `Bearer ${apiKey}` },
        cache: "no-store",
        signal: AbortSignal.timeout(ROSTER_TIMEOUT_MS),
      },
    );
    const body: unknown = await res.json().catch(() => null);
    return parseRosterResponse(res.status, body);
  } catch {
    return NOBODY;
  }
}
