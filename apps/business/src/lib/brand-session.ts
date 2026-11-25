import { auth } from "@/auth";
import { parseBrandId, parseRole, type Role } from "@/lib/access";
import { canonicalEmail } from "@/lib/roster";

/**
 * The signed-in brand user, read on the server (TAP-T17).
 *
 * This is the ONLY way to get a {@link BrandSession}, and every services
 * call needs one (lib/brand-services.ts). So the brand a call is made under
 * always comes from the session token, never from the browser.
 */
declare const brandSessionMark: unique symbol;

export interface BrandSession {
  readonly email: string;
  readonly role: Role;
  readonly brandId: string;
  readonly [brandSessionMark]: true;
}

/** Pure: a session's user → a brand session, or null. Unit-tested. */
export function toBrandSession(user: unknown): BrandSession | null {
  if (typeof user !== "object" || user === null) return null;
  const record = user as { email?: unknown; role?: unknown; businessId?: unknown };
  const email = canonicalEmail(record.email);
  const role = parseRole(record.role);
  const brandId = parseBrandId(record.businessId);
  if (email === null || role === null || brandId === null) return null;
  return { email, role, brandId } as BrandSession;
}

/** The brand session for this request, or null (also outside a request). */
export async function getBrandSession(): Promise<BrandSession | null> {
  try {
    const session = await auth();
    return toBrandSession(session?.user);
  } catch {
    return null;
  }
}
