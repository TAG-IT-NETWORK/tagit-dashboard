/**
 * Brand records as the console reads them (TAP-T16). PURE: parsing and the
 * words of the Brands page, so both are unit-testable without a browser.
 */

export interface Brand {
  id: string;
  name: string;
  logoUrl: string | null;
  treasuryWallet: string | null;
  defaultMintRecipient: string | null;
}

const text = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

/** tagit-services' brand list, or [] for anything that is not one. Rows without an id or name are dropped. */
export function parseBrands(value: unknown): Brand[] {
  if (!Array.isArray(value)) return [];
  const out: Brand[] = [];
  for (const raw of value) {
    if (typeof raw !== "object" || raw === null) continue;
    const row = raw as Record<string, unknown>;
    const id = text(row.id);
    const name = text(row.name);
    if (!id || !name) continue;
    out.push({
      id,
      name,
      logoUrl: text(row.logoUrl),
      treasuryWallet: text(row.treasuryWallet),
      defaultMintRecipient: text(row.defaultMintRecipient),
    });
  }
  return out;
}

export interface UnassignedTemplate {
  id: string;
  name: string;
  sku: string | null;
  status: string;
}

/** The templates of a services list that belong to NO brand, reduced to what the picker shows. */
export function unassignedTemplates(value: unknown): UnassignedTemplate[] {
  if (!Array.isArray(value)) return [];
  const out: UnassignedTemplate[] = [];
  for (const raw of value) {
    if (typeof raw !== "object" || raw === null) continue;
    const row = raw as Record<string, unknown>;
    const id = text(row.id);
    // Only an explicit "no brand". A row whose brand is missing from the
    // answer is not offered: it may well have one.
    if (!id || row.businessId !== null) continue;
    out.push({
      id,
      name: text(row.name) ?? id,
      sku: text(row.sku),
      status: text(row.status) ?? "draft",
    });
  }
  return out;
}

/** A new brand's id, as tagit-services takes it. Mirrors NEW_BUSINESS_ID there. */
const NEW_BRAND_ID = /^[a-z0-9][a-z0-9-]{1,62}$/;

/** "Aurora Skin Co." → "aurora-skin-co": a starting point the admin can edit. */
export function suggestBrandId(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

export function isValidBrandId(id: string): boolean {
  return NEW_BRAND_ID.test(id);
}

const WALLET = /^0x[0-9a-fA-F]{40}$/;

/** "" is "none"; anything else must look like a wallet. The server checks the rest. */
export function isWalletOrEmpty(value: string): boolean {
  return value === "" || WALLET.test(value);
}

/** What a failed brand request says, by tagit-services' short code. Never the code itself alone. */
export function brandError(code: unknown, status: number): string {
  switch (code) {
    case "BUSINESS_EXISTS":
      return "A brand with that ID already exists. Choose another ID.";
    case "UNKNOWN_BUSINESS":
    case "NOT_FOUND":
      return "That brand no longer exists. Refresh the page.";
    case "PLATFORM_ONLY":
    case "FORBIDDEN":
      return "Only a platform admin can manage brands.";
    case "VALIDATION_ERROR":
    case "INVALID_REQUEST":
      return "Some details were not accepted. Check the ID, the logo address and the wallet addresses.";
    case "UNAUTHENTICATED":
      return "Your session ended. Sign in again.";
    default:
      return `Could not reach the brand service (${status}). Try again.`;
  }
}

export interface AssignOutcome {
  templates: { assigned: string[]; skipped: Array<{ id: string; reason: string }> };
  items: { assigned: string[]; skipped: Array<{ id: string; reason: string }> };
  listings: number;
}

function list(value: unknown): {
  assigned: string[];
  skipped: Array<{ id: string; reason: string }>;
} {
  const v = (value ?? {}) as { assigned?: unknown; skipped?: unknown };
  const assigned = Array.isArray(v.assigned)
    ? v.assigned.filter((x): x is string => typeof x === "string")
    : [];
  const skipped = Array.isArray(v.skipped)
    ? v.skipped.flatMap((x) => {
        const r = (x ?? {}) as { id?: unknown; reason?: unknown };
        return typeof r.id === "string" && typeof r.reason === "string"
          ? [{ id: r.id, reason: r.reason }]
          : [];
      })
    : [];
  return { assigned, skipped };
}

export function parseAssignOutcome(body: unknown): AssignOutcome | null {
  const b = (body ?? {}) as Record<string, unknown>;
  if (b.ok !== true) return null;
  return {
    templates: list(b.templates),
    items: list(b.items),
    listings: typeof b.listings === "number" ? b.listings : 0,
  };
}

const SKIP_WORDS: Record<string, string> = {
  has_brand: "already belongs to a brand",
  not_found: "was not found",
  has_template: "belongs to a product; give the product instead",
};

/** One plain sentence about what an assign did, and one line per thing it left alone. */
export function describeAssign(outcome: AssignOutcome, brandName: string): string[] {
  const moved = outcome.templates.assigned.length;
  const lines: string[] = [];
  if (moved > 0) {
    lines.push(
      `${moved} product${moved === 1 ? "" : "s"} now belong${moved === 1 ? "s" : ""} to ${brandName}, with every item made from ${moved === 1 ? "it" : "them"}.`,
    );
  }
  if (outcome.items.assigned.length > 0) {
    const n = outcome.items.assigned.length;
    lines.push(
      `${n} single item${n === 1 ? "" : "s"} now belong${n === 1 ? "s" : ""} to ${brandName}.`,
    );
  }
  if (lines.length === 0) lines.push("Nothing was moved.");
  for (const skipped of [...outcome.templates.skipped, ...outcome.items.skipped]) {
    lines.push(`${skipped.id} ${SKIP_WORDS[skipped.reason] ?? "was left as it is"}.`);
  }
  return lines;
}
