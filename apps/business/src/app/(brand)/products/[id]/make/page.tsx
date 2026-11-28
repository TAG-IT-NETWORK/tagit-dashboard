import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { QuantityForm } from "@/components/make-items";
import { SIGN_IN_PATH } from "@/lib/access";
import { countWords } from "@/lib/brand-catalog";
import {
  canMakeItems,
  MAX_ITEMS_PER_RUN,
  runStateWords,
  takesRunFacts,
} from "@/lib/brand-make-items";
import { parseProductId } from "@/lib/brand-product-form";
import { loadBrand } from "@/lib/brand-request";
import { getBrandProduct, getBrandRuns } from "@/lib/brand-services";

export const metadata: Metadata = { title: "Make items · TAG IT Business" };

/** Step 1 of making items: how many (TAP-T17). Managers only. */
export default async function MakeItemsPage({ params }: { params: Promise<{ id: string }> }) {
  const [brand, { id }] = await Promise.all([loadBrand(), params]);
  if (brand === null) redirect(SIGN_IN_PATH);
  const productId = parseProductId(id);
  const product = productId !== null ? await getBrandProduct(brand.session, productId) : null;
  if (product === null) notFound();

  const manager = canMakeItems(brand.session.role);
  const runs = await getBrandRuns(brand.session, product.id);
  const published = product.state === "live" || product.state === "live-with-changes";

  return (
    <div className="max-w-2xl space-y-6">
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
        <h1 className="break-words text-3xl font-semibold tracking-tight">Make items</h1>
        <p className="text-sm text-muted-foreground">
          Each item is one physical unit of {product.values.name}, with its own record.
        </p>
      </div>

      {!manager ? (
        <p className="rounded-xl border p-4 text-sm text-muted-foreground">
          Only a Manager of your brand can make items.
        </p>
      ) : !published ? (
        <p className="rounded-xl border p-4 text-sm text-muted-foreground">
          {product.state === "archived"
            ? "This product is archived. Items can no longer be made from it."
            : "Publish this product first. Items are made from the published version."}
        </p>
      ) : (
        <>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>An item cannot be un-made once it is made.</li>
            <li>Your brand can make up to 500 items in any 24 hours.</li>
            <li>After they are made, TAG IT attaches a tag to each one.</li>
            {product.state === "live-with-changes" ? (
              <li>
                This product has changes that are not published. Items are made from the published
                version.
              </li>
            ) : null}
          </ul>
          <QuantityForm
            productId={product.id}
            max={MAX_ITEMS_PER_RUN}
            withFacts={takesRunFacts(product.publishedCategory)}
          />
        </>
      )}

      <section className="space-y-3">
        <h2 className="font-semibold">Runs so far</h2>
        {runs === null ? (
          <p role="alert" className="rounded-xl border p-4 text-sm">
            The runs could not be loaded just now. Refresh the page in a moment.
          </p>
        ) : runs.length === 0 ? (
          <p className="rounded-xl border p-4 text-sm text-muted-foreground">
            No items have been made from this product in the brand app yet.
          </p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {runs.map((run) => (
              <li
                key={run.id}
                className="flex flex-col gap-1 p-4 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-6"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {manager ? (
                      <Link href={`/products/${product.id}/make/${run.id}`} className="underline">
                        {countWords(run.size, "item", "items")}
                      </Link>
                    ) : (
                      countWords(run.size, "item", "items")
                    )}
                  </p>
                  <p className="break-words text-xs text-muted-foreground">
                    {[run.day, run.by ? `by ${run.by}` : null].filter(Boolean).join(" · ") ||
                      "Date not known"}
                  </p>
                </div>
                <span className="shrink-0 text-muted-foreground">{runStateWords(run.state)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
