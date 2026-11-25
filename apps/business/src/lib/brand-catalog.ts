/**
 * A brand's products and counts, worked out from untrusted answers
 * (TAP-T17, slice 2). Pure, so it is unit-tested without a server.
 *
 * Every row is checked again here: a product that does not carry THIS
 * brand's id is dropped, whatever the answer says. tagit-services already
 * scopes by brand; this is the second wall.
 */

export type ProductStatus = "published" | "draft" | "archived";

export interface Product {
  id: string;
  name: string;
  /** Model, SKU and category, each only when the brand filled it in. */
  model: string | null;
  sku: string | null;
  category: string | null;
  status: ProductStatus;
  /** Ready to show, e.g. "$29.99", or null when no price is set. */
  price: string | null;
  /** How many items were made from this product; null when not known. */
  items: number | null;
}

export interface ProductList {
  /** False when the list could not be read; the page then says so. */
  loaded: boolean;
  products: Product[];
}

export interface ItemCounts {
  items: number;
  forSale: number;
  withCustomers: number;
  flagged: number;
}

const MAX_PRODUCTS = 500;
const STATUSES: readonly string[] = ["published", "draft", "archived"];
const STATUS_ORDER: Record<ProductStatus, number> = { published: 0, draft: 1, archived: 2 };

function text(value: unknown, max = 200): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, max) : null;
}

/** A whole number of things, or null. Never negative, never a fraction. */
function count(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

/**
 * A price kept as millionths of a dollar ("29990000") shown as dollars.
 * Anything that is not a plain run of digits, and zero, shows as no price.
 */
export function formatPrice(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{1,18}$/.test(value)) return null;
  const minor = BigInt(value);
  if (minor === 0n) return null;
  // Round to the nearest cent, half up.
  const cents = (minor + 5_000n) / 10_000n;
  const dollars = (cents / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `$${dollars}.${(cents % 100n).toString().padStart(2, "0")}`;
}

export function parseProducts(status: number, body: unknown, brandId: string): ProductList {
  const failed: ProductList = { loaded: false, products: [] };
  if (status !== 200 || typeof body !== "object" || body === null) return failed;
  const answer = body as { ok?: unknown; templates?: unknown };
  if (answer.ok !== true || !Array.isArray(answer.templates)) return failed;

  const products: Product[] = [];
  for (const raw of answer.templates.slice(0, MAX_PRODUCTS)) {
    if (typeof raw !== "object" || raw === null) continue;
    const row = raw as Record<string, unknown>;
    // Another brand's product, or one with no brand, is never shown.
    if (row.businessId !== brandId) continue;
    const id = text(row.id, 100);
    const name = text(row.name);
    if (id === null || name === null) continue;
    if (typeof row.status !== "string" || !STATUSES.includes(row.status)) continue;
    products.push({
      id,
      name,
      model: text(row.model),
      sku: text(row.sku),
      category: text(row.category),
      status: row.status as ProductStatus,
      price: formatPrice(row.priceUsdc6),
      // An unknown count stays unknown: it is never shown as zero.
      items: count(row.itemsCount),
    });
  }
  products.sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name),
  );
  return { loaded: true, products };
}

/** Item counts, or null when the answer cannot be trusted as a whole. */
export function parseSummary(status: number, body: unknown): ItemCounts | null {
  if (status !== 200 || typeof body !== "object" || body === null) return null;
  const answer = body as { ok?: unknown; summary?: unknown };
  if (answer.ok !== true || typeof answer.summary !== "object" || answer.summary === null) {
    return null;
  }
  const summary = answer.summary as { items?: unknown; forSale?: unknown; byState?: unknown };
  const byState =
    typeof summary.byState === "object" && summary.byState !== null
      ? (summary.byState as Record<string, unknown>)
      : null;
  const items = count(summary.items);
  const forSale = count(summary.forSale);
  const withCustomers = byState ? count(byState.CLAIMED) : null;
  const flagged = byState ? count(byState.FLAGGED) : null;
  if (items === null || forSale === null || withCustomers === null || flagged === null) return null;
  // Parts can never be more than the whole.
  if (forSale > items || withCustomers + flagged > items) return null;
  return { items, forSale, withCustomers, flagged };
}

/** Products a brand is actually running: everything it has not archived. */
export function activeProductCount(list: ProductList): number | null {
  return list.loaded ? list.products.filter((p) => p.status !== "archived").length : null;
}

export function statusWords(status: ProductStatus): string {
  switch (status) {
    case "published":
      return "Live";
    case "draft":
      return "Draft";
    default:
      return "Archived";
  }
}

/** A count for a tile: "1,204", or a dash when it could not be read. */
export function tileNumber(value: number | null): string {
  return value === null ? "–" : value.toLocaleString("en-US");
}

/** How many items a product has, in words; a dash when not known. */
export function itemsWords(items: number | null): string {
  return items === null ? "–" : countWords(items, "item", "items");
}

/** "1 item", "3 items", with thousands separators. */
export function countWords(n: number, one: string, many: string): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}
