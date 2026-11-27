import type { Role } from "@/lib/access";

/**
 * What the brand home shows, worked out from untrusted answers (TAP-T17).
 * Pure, so it is unit-tested without a server.
 */

export interface BrandProfile {
  /** The brand's name, or its id when the record could not be read. */
  name: string;
  /**
   * True only when `name` is the brand's real name, read from its record.
   * False means `name` is a stand-in for display: fine in a header, never
   * to be SAVED anywhere as the brand's name.
   */
  nameKnown: boolean;
  /** An https address safe to put in an <img>, or null. */
  logoUrl: string | null;
}

/**
 * A logo address is used only when it is a plain https URL. Anything else
 * (http, data:, javascript:, a relative path, credentials in the address)
 * is dropped and the page shows the brand's initial instead.
 */
export function safeLogoUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 500) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "") return null;
  return url.toString();
}

/**
 * The brand's record as tagit-services returned it. When the record cannot
 * be read (no record yet, an error) the page still opens, under the brand id.
 */
export function parseBrandProfile(status: number, body: unknown, brandId: string): BrandProfile {
  const fallback: BrandProfile = { name: brandId, nameKnown: false, logoUrl: null };
  if (status !== 200 || typeof body !== "object" || body === null) return fallback;
  const record = body as {
    ok?: unknown;
    business?: { id?: unknown; name?: unknown; logoUrl?: unknown };
  };
  // An answer about a DIFFERENT brand is never shown, whatever it says.
  if (record.ok !== true || record.business?.id !== brandId) return fallback;
  const rawName = record.business.name;
  const nameKnown = typeof rawName === "string" && rawName.trim().length > 0;
  const name = nameKnown ? rawName.trim().slice(0, 200) : brandId;
  return { name, nameKnown, logoUrl: safeLogoUrl(record.business.logoUrl) };
}

/** The role in plain words. */
export function roleWords(role: Role): string {
  switch (role) {
    case "admin":
      return "Manager";
    case "operator":
      return "Editor";
    default:
      return "View only";
  }
}

/** One or two letters to stand in for a missing logo. */
export function brandInitials(name: string): string {
  const letters = name
    .split(/[\s_-]+/)
    .map((part) => part.match(/[\p{L}\p{N}]/u)?.[0] ?? "")
    .filter(Boolean)
    .slice(0, 2)
    .join("");
  return letters.toUpperCase() || "?";
}
