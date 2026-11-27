import { formatPrice } from "@/lib/brand-catalog";

/**
 * The items of one of a brand's products, worked out from untrusted answers
 * (TAP-T17). Pure, so it is unit-tested without a server.
 *
 * tagit-services checks the product belongs to the brand before it lists
 * anything, and lists only that brand's rows. Here every row is checked
 * again against the PRODUCT that was asked for: a row filed under another
 * product is dropped, and an answer about another product is not shown at
 * all. The page also loads the product itself first, which is refused for
 * another brand's product (lib/brand-services.ts).
 */

export type ItemState =
  | "being-made"
  | "made"
  | "tagged"
  | "ready"
  | "for-sale"
  | "with-customer"
  | "flagged"
  | "retired"
  | "unknown";

export interface BrandItem {
  /** The item's number in the registry, as text. */
  number: string;
  /** The brand's own serial for it, when it has one. */
  serial: string | null;
  state: ItemState;
  /** Ready to show, e.g. "$29.99". Only while the item is for sale. */
  price: string | null;
  /** The day it last changed, e.g. "Nov 27, 2026", or null. */
  changed: string | null;
}

export interface ItemPage {
  /** False when the list could not be read; the page then says so. */
  loaded: boolean;
  items: BrandItem[];
  /** Where the next page starts, or null on the last page. */
  next: string | null;
}

export const ITEMS_PER_PAGE = 50;

const NUMBER_RE = /^\d{1,30}$/;

/** A page position from the address bar: digits only, or null. */
export function parseCursor(value: unknown): string | null {
  return typeof value === "string" && NUMBER_RE.test(value) ? value : null;
}

/**
 * Where an item is in its life, in the brand's words. An item is "for sale"
 * only when it is ready AND carries a price: a price on an item that is not
 * ready yet, or left on one a customer already owns, does not make it so.
 */
export function itemState(chainState: unknown, listedPrice: string | null): ItemState {
  switch (chainState) {
    case null:
    case undefined:
      return "being-made";
    case "MINTED":
      return "made";
    case "BOUND":
      return "tagged";
    case "ACTIVATED":
      return listedPrice !== null ? "for-sale" : "ready";
    case "CLAIMED":
      return "with-customer";
    case "FLAGGED":
      return "flagged";
    case "RECYCLED":
      return "retired";
    default:
      return "unknown";
  }
}

const STATE_WORDS: Record<ItemState, string> = {
  "being-made": "Being made",
  made: "Made, tag not attached yet",
  tagged: "Tag attached",
  ready: "Ready for sale",
  "for-sale": "For sale",
  "with-customer": "With a customer",
  flagged: "Flagged",
  retired: "Retired",
  unknown: "Not known",
};

export function itemStateWords(state: ItemState): string {
  return STATE_WORDS[state];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** An ISO time as a plain day (UTC, so the server and every reader agree), or null. */
export function dayWords(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 40) return null;
  const time = Date.parse(value);
  if (Number.isNaN(time)) return null;
  const date = new Date(time);
  const year = date.getUTCFullYear();
  if (year < 2020 || year > 2100) return null;
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${year}`;
}

function serialOf(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 100) : null;
}

export function parseItems(status: number, body: unknown, productId: string): ItemPage {
  const failed: ItemPage = { loaded: false, items: [], next: null };
  if (status !== 200 || typeof body !== "object" || body === null) return failed;
  const answer = body as {
    ok?: unknown;
    templateId?: unknown;
    items?: unknown;
    nextCursor?: unknown;
  };
  // An answer about another product is not shown, whatever it holds.
  if (answer.ok !== true || answer.templateId !== productId || !Array.isArray(answer.items)) {
    return failed;
  }

  const items: BrandItem[] = [];
  const seen = new Set<string>();
  for (const raw of answer.items.slice(0, ITEMS_PER_PAGE)) {
    if (typeof raw !== "object" || raw === null) continue;
    const row = raw as Record<string, unknown>;
    // A row filed under another product is never shown here.
    if (row.templateId !== productId) continue;
    if (typeof row.tokenId !== "string" || !NUMBER_RE.test(row.tokenId)) continue;
    if (seen.has(row.tokenId)) continue;
    seen.add(row.tokenId);
    const listedPrice = formatPrice(row.priceUsdc6);
    const state = itemState(row.chainState, listedPrice);
    items.push({
      number: row.tokenId,
      serial: serialOf(row.serial),
      state,
      price: state === "for-sale" ? listedPrice : null,
      changed: dayWords(row.updatedAt),
    });
  }
  return { loaded: true, items, next: parseCursor(answer.nextCursor) };
}

/** How many of the items shown are in each state, in a fixed order, zeros left out. */
export function stateTally(
  items: readonly BrandItem[],
): Array<{ state: ItemState; count: number }> {
  const order: ItemState[] = [
    "for-sale",
    "ready",
    "with-customer",
    "tagged",
    "made",
    "being-made",
    "flagged",
    "retired",
    "unknown",
  ];
  return order
    .map((state) => ({ state, count: items.filter((item) => item.state === state).length }))
    .filter((entry) => entry.count > 0);
}
