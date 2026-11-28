"use server";

import { redirect } from "next/navigation";

import { SIGN_IN_PATH } from "@/lib/access";
import { parseCursor } from "@/lib/brand-items";
import { parseProductId } from "@/lib/brand-product-form";
import { loadBrand } from "@/lib/brand-request";
import {
  canSellItems,
  parseItemNumber,
  parseSaleIntent,
  parseSalePrice,
  saleProblem,
} from "@/lib/brand-selling";
import { getBrandProduct, getBrandProductItems, setBrandItemSale } from "@/lib/brand-services";

/**
 * Selling (TAP-T17). SERVER ONLY.
 *
 * Every action, before anything else:
 *   1. reads the session on the server. No brand session → sign in.
 *   2. checks the role: a Manager, nobody else. The page hides the controls
 *      from others too, but this is the check that counts.
 *   3. takes the brand from the session and nothing else. The product is
 *      loaded under that brand first.
 *
 * What reaches the API is a checked item number, one of three actions and a
 * checked price. Where the money goes is the API's decision, never the
 * form's. The API also decides whether each item can be sold at all.
 */

export interface SellState {
  problem: string | null;
}

const MANAGERS_ONLY = "Only a Manager of your brand can change what is on sale.";
const BAD_PRICE = "Enter a price in dollars from 0.01 to 1,000,000, like 49.50.";

function backTo(productId: string, after: string | null, done: string): string {
  const query = new URLSearchParams();
  if (after !== null) query.set("after", after);
  query.set("done", done);
  return `/products/${productId}/items?${query.toString()}`;
}

/** One item: put on sale, change the price, or take off sale. */
export async function sellItem(_previous: SellState, formData: FormData): Promise<SellState> {
  const brand = await loadBrand();
  if (brand === null) redirect(SIGN_IN_PATH);
  const { session } = brand;
  if (!canSellItems(session.role)) return { problem: MANAGERS_ONLY };

  const intent = parseSaleIntent(formData.get("intent"));
  const number = parseItemNumber(formData.get("item"));
  if (intent === null || number === null) {
    return { problem: "That could not be done. Refresh the page and try again." };
  }
  const price = intent === "delist" ? null : parseSalePrice(formData.get("price"));
  if (intent !== "delist" && price === null) return { problem: BAD_PRICE };

  const productId = parseProductId(formData.get("productId"));
  const product = productId !== null ? await getBrandProduct(session, productId) : null;
  if (product === null) return { problem: "This product could not be found." };

  const result = await setBrandItemSale(session, number, intent, price);
  if (result.kind !== "done") return { problem: saleProblem(result) };
  redirect(backTo(product.id, parseCursor(formData.get("after")), intent));
}

const AT_ONCE = 5;

/** Every item on the page that is ready for sale, at one price. */
export async function sellReadyItems(_previous: SellState, formData: FormData): Promise<SellState> {
  const brand = await loadBrand();
  if (brand === null) redirect(SIGN_IN_PATH);
  const { session } = brand;
  if (!canSellItems(session.role)) return { problem: MANAGERS_ONLY };

  const price = parseSalePrice(formData.get("price"));
  if (price === null) return { problem: BAD_PRICE };
  const productId = parseProductId(formData.get("productId"));
  const product = productId !== null ? await getBrandProduct(session, productId) : null;
  if (product === null) return { problem: "This product could not be found." };

  // The items are read again here, on the server: the list in the browser is
  // not trusted to say which items are ready.
  const after = parseCursor(formData.get("after"));
  const page = await getBrandProductItems(session, product.id, after);
  if (!page.loaded) {
    return {
      problem:
        "The items could not be loaded just now. Nothing was changed. Try again in a moment.",
    };
  }
  const ready = page.items.filter((item) => item.state === "ready").map((item) => item.number);

  let done = 0;
  let failed = 0;
  for (let i = 0; i < ready.length; i += AT_ONCE) {
    const results = await Promise.all(
      ready.slice(i, i + AT_ONCE).map((number) => setBrandItemSale(session, number, "list", price)),
    );
    for (const result of results) {
      if (result.kind === "done") done += 1;
      else failed += 1;
    }
  }
  redirect(backTo(product.id, after, `bulk-${done}-${failed}`));
}
