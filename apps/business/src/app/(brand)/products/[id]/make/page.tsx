import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { QuantityForm } from "@/components/make-items";
import { SIGN_IN_PATH } from "@/lib/access";
import { canMakeItems, MAX_ITEMS_PER_RUN } from "@/lib/brand-make-items";
import { parseProductId } from "@/lib/brand-product-form";
import { loadBrand } from "@/lib/brand-request";
import { getBrandProduct } from "@/lib/brand-services";

export const metadata: Metadata = { title: "Make items · TAG IT Business" };

/** Step 1 of making items: how many (TAP-T17). Managers only. */
export default async function MakeItemsPage({ params }: { params: Promise<{ id: string }> }) {
  const [brand, { id }] = await Promise.all([loadBrand(), params]);
  if (brand === null) redirect(SIGN_IN_PATH);
  const productId = parseProductId(id);
  const product = productId !== null ? await getBrandProduct(brand.session, productId) : null;
  if (product === null) notFound();

  const manager = canMakeItems(brand.session.role);
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
          <QuantityForm productId={product.id} max={MAX_ITEMS_PER_RUN} />
        </>
      )}
    </div>
  );
}
