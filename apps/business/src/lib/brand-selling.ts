import { hasRole, type Role } from "@/lib/access";

/**
 * A brand sells its own items (TAP-T17). PURE logic, unit-tested without a
 * server: who may do it, what is sent, and how untrusted answers are read.
 *
 * Three rules:
 * - only a Manager may put an item on sale, change its price or take it off,
 *   decided on the server ({@link canSellItems});
 * - what is sent is an action and a price, built here from checked values.
 *   Where the money goes is NOT something the brand app can say: the API
 *   pays the brand's own sale wallet;
 * - the API decides whether an item can be sold (it must be ready for sale
 *   and still the brand's). Its refusals are turned into plain words here.
 */

/** Put on sale, change price, take off sale: Managers only. */
export function canSellItems(role: Role | null): boolean {
  return hasRole(role, "admin");
}

/** The most that can be asked for one item, in dollars. */
export const MAX_SALE_PRICE = 1_000_000;

/**
 * A price as typed, in dollars: "49", "49.5" or "49.50", from 0.01 to
 * 1,000,000. Returned with two decimals ("49.50"), or null. No signs, no
 * separators, no more than two decimals: a slip of the finger is refused,
 * not rounded.
 */
export function parseSalePrice(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const typed = value.trim();
  const match = /^(0|[1-9]\d{0,6})(?:\.(\d{1,2}))?$/.exec(typed);
  if (!match) return null;
  const dollars = Number(match[1]);
  const cents = Number((match[2] ?? "").padEnd(2, "0"));
  const total = dollars * 100 + cents;
  if (total < 1 || total > MAX_SALE_PRICE * 100) return null;
  return `${dollars}.${String(cents).padStart(2, "0")}`;
}

/** An item's number as the registry writes it: digits only, or null. */
export function parseItemNumber(value: unknown): string | null {
  return typeof value === "string" && /^(0|[1-9]\d{0,29})$/.test(value) ? value : null;
}

export type SaleIntent = "list" | "reprice" | "delist";

export function parseSaleIntent(value: unknown): SaleIntent | null {
  return value === "list" || value === "reprice" || value === "delist" ? value : null;
}

export interface SaleBody {
  action: "LIST" | "UPDATE" | "DELIST";
  priceUsdc?: string;
}

/** What is sent. A price goes with list and reprice, never with a take-off. */
export function saleBody(intent: SaleIntent, price: string | null): SaleBody | null {
  if (intent === "delist") return { action: "DELIST" };
  if (price === null || parseSalePrice(price) !== price) return null;
  return { action: intent === "list" ? "LIST" : "UPDATE", priceUsdc: price };
}

export type SaleResult =
  | { kind: "done" }
  | { kind: "not-ready" }
  | { kind: "not-ours" }
  | { kind: "not-set-up" }
  | { kind: "gone" }
  | { kind: "failed" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** What the API said. Done only when it names this item and the state asked for. */
export function parseSaleAnswer(
  status: number,
  body: unknown,
  itemNumber: string,
  intent: SaleIntent,
): SaleResult {
  if (!isRecord(body)) return { kind: "failed" };
  if (status === 200 && body.ok === true) {
    const wanted = intent === "delist" ? "delisted" : "listed";
    return body.tokenId === itemNumber && body.listingStatus === wanted
      ? { kind: "done" }
      : { kind: "failed" };
  }
  const code = body.error;
  if (status === 409 && code === "ITEM_NOT_READY_FOR_SALE") return { kind: "not-ready" };
  if (status === 409 && code === "ITEM_NOT_HELD_BY_BRAND") return { kind: "not-ours" };
  if (
    status === 409 &&
    (code === "BRAND_TREASURY_MISSING" || code === "BRAND_MINT_WALLET_MISSING")
  ) {
    return { kind: "not-set-up" };
  }
  if (status === 404) return { kind: "gone" };
  return { kind: "failed" };
}

/** Why it did not happen, in plain words. Never the API's own text. */
export function saleProblem(result: Exclude<SaleResult, { kind: "done" }>): string {
  switch (result.kind) {
    case "not-ready":
      return "This item is not ready for sale yet. It needs its tag attached and checked first. Nothing was changed.";
    case "not-ours":
      return "This item is no longer your brand's to sell: a customer has it. Nothing was changed.";
    case "not-set-up":
      return "Your brand is not fully set up to be paid yet. Nothing was changed. Ask TAG IT to finish your brand's setup.";
    case "gone":
      return "This item is not on sale by your brand, so there is nothing to change. Refresh the page.";
    case "failed":
      return "That could not be done just now. Nothing was changed. Try again in a moment.";
  }
}

/** How a bulk "put on sale" went, in one plain sentence. */
export function bulkWords(done: number, failed: number): string {
  const items = (n: number) => `${n} ${n === 1 ? "item" : "items"}`;
  if (done === 0 && failed === 0) return "There were no items ready for sale on that page.";
  if (failed === 0) return `${items(done)} put on sale.`;
  if (done === 0)
    return `None could be put on sale just now (${items(failed)}). Try again in a moment.`;
  return `${items(done)} put on sale. ${items(failed)} could not be; try those again.`;
}
