import { isBrandIdentity, type RosterIdentity } from "@/lib/roster";

/**
 * May this Google account start a session in the brand app? (TAP-T17)
 * Pure, so the rule is unit-tested without the sign-in library.
 *
 * Yes only when Google says the email is verified AND the roster has that
 * email with a brand. Everyone else is refused before any session exists.
 */
export function mayStartSession(input: {
  provider: unknown;
  emailVerified: unknown;
  identity: RosterIdentity;
}): boolean {
  if (input.provider !== "google") return false;
  if (input.emailVerified !== true) return false;
  return isBrandIdentity(input.identity);
}
