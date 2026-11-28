import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ItemSaleForm, SellReadyForm } from "@/components/sale-controls";
import { SIGN_IN_PATH } from "@/lib/access";
import { countWords } from "@/lib/brand-catalog";
import {
  itemStateWords,
  parseCursor,
  stateTally,
  type BrandItem,
  type ItemState,
} from "@/lib/brand-items";
import { parseProductId } from "@/lib/brand-product-form";
import { loadBrand } from "@/lib/brand-request";
import { bulkWords, canSellItems } from "@/lib/brand-selling";
import { getBrandProduct, getBrandProductItems } from "@/lib/brand-services";

export const metadata: Metadata = { title: "Items · TAG IT Business" };

const STATE_STYLE: Record<ItemState, string> = {
  "for-sale": "border-emerald-300 bg-emerald-50 text-emerald-900",
  ready: "border-emerald-300 bg-transparent text-emerald-900",
  "with-customer": "border-sky-300 bg-sky-50 text-sky-900",
  tagged: "border-border bg-muted text-foreground",
  made: "border-border bg-muted text-foreground",
  "being-made": "border-border bg-transparent text-muted-foreground",
  flagged: "border-amber-300 bg-amber-50 text-amber-900",
  retired: "border-border bg-transparent text-muted-foreground",
  unknown: "border-border bg-transparent text-muted-foreground",
};

/** What a finished action says back, from the address bar. Fixed sentences only. */
function doneWords(value: unknown): string | null {
  if (value === "list") return "Put on sale.";
  if (value === "reprice") return "Price changed.";
  if (value === "delist") return "Taken off sale.";
  const bulk = typeof value === "string" ? /^bulk-(\d{1,3})-(\d{1,3})$/.exec(value) : null;
  return bulk ? bulkWords(Number(bulk[1]), Number(bulk[2])) : null;
}

/** A shown price ("$1,049.50") as the price field takes it ("1049.50"). */
function priceForField(shown: string | null): string {
  return shown === null ? "" : shown.replace(/[$,]/g, "");
}

function ItemRow({
  item,
  sale,
}: {
  item: BrandItem;
  /** Set for a Manager: what the sale controls need. */
  sale: { productId: string; after: string | null; defaultPrice: string } | null;
}) {
  const sellable = sale !== null && (item.state === "ready" || item.state === "for-sale");
  return (
    <li className="space-y-3 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <p className="break-words font-medium">{item.serial ?? `Item ${item.number}`}</p>
          <p className="text-xs text-muted-foreground">
            No. {item.number}
            {item.changed ? ` · last changed ${item.changed}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {item.price ? <span className="text-sm tabular-nums">{item.price}</span> : null}
          <span
            className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATE_STYLE[item.state]}`}
          >
            {itemStateWords(item.state)}
          </span>
        </div>
      </div>
      {sellable ? (
        <ItemSaleForm
          key={`${item.number}:${item.state}:${item.price ?? ""}`}
          productId={sale.productId}
          after={sale.after}
          item={item.number}
          onSale={item.state === "for-sale"}
          defaultPrice={item.state === "for-sale" ? priceForField(item.price) : sale.defaultPrice}
        />
      ) : null}
    </li>
  );
}

/**
 * The items of one product (TAP-T17). Every role may look. A Manager can also
 * put ready items on sale, change a price and take an item off sale.
 */
export default async function ProductItemsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ after?: string | string[]; done?: string | string[] }>;
}) {
  const [brand, { id }, query] = await Promise.all([loadBrand(), params, searchParams]);
  if (brand === null) redirect(SIGN_IN_PATH);
  const productId = parseProductId(id);
  // The product is loaded first: another brand's product, a wrong id and a
  // missing one all read as not found, and no item list is asked for.
  const product = productId !== null ? await getBrandProduct(brand.session, productId) : null;
  if (product === null) notFound();

  const after = parseCursor(query.after);
  const page = await getBrandProductItems(brand.session, product.id, after);
  const tally = stateTally(page.items);
  const manager = canSellItems(brand.session.role);
  const sale = manager
    ? { productId: product.id, after, defaultPrice: product.values.price }
    : null;
  const readyCount = page.items.filter((item) => item.state === "ready").length;
  const done = doneWords(query.done);

  return (
    <div className="max-w-3xl space-y-6">
      <p className="text-sm">
        <Link href="/products" className="underline">
          Products
        </Link>
        {" / "}
        <Link href={`/products/${product.id}`} className="underline">
          {product.values.name}
        </Link>
      </p>
      <div className="space-y-2">
        <h1 className="break-words text-3xl font-semibold tracking-tight">Items</h1>
        <p className="text-sm text-muted-foreground">
          Every item made from {product.values.name}, and where it is now.
        </p>
      </div>

      {done ? (
        <p
          role="status"
          className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900"
        >
          {done}
        </p>
      ) : null}

      {manager && page.loaded && readyCount > 0 ? (
        <SellReadyForm
          productId={product.id}
          after={after}
          count={readyCount}
          defaultPrice={product.values.price}
        />
      ) : null}

      {!page.loaded ? (
        <p role="alert" className="rounded-xl border p-6 text-sm">
          The items could not be loaded just now. Refresh the page in a moment.
        </p>
      ) : page.items.length === 0 ? (
        <p className="rounded-xl border p-6 text-sm text-muted-foreground">
          {after === null
            ? "No items have been made from this product yet."
            : "There are no more items."}
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {countWords(page.items.length, "item", "items")} on this page
            {after !== null || page.next !== null ? " (the list continues)" : ""}:{" "}
            {tally
              .map((entry) => `${entry.count} ${itemStateWords(entry.state).toLowerCase()}`)
              .join(", ")}
            .
          </p>
          <ul className="divide-y rounded-xl border">
            {page.items.map((item) => (
              <ItemRow key={item.number} item={item} sale={sale} />
            ))}
          </ul>
        </>
      )}

      {page.loaded && (after !== null || page.next !== null) ? (
        <nav aria-label="Pages" className="flex items-center gap-4 text-sm">
          {after !== null ? (
            <Link href={`/products/${product.id}/items`} className="underline">
              Back to the start
            </Link>
          ) : null}
          {page.next !== null ? (
            <Link href={`/products/${product.id}/items?after=${page.next}`} className="underline">
              Next page
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
