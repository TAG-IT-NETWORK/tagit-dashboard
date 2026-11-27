import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ProductForm, PublishButton } from "@/components/product-form";
import { SIGN_IN_PATH } from "@/lib/access";
import {
  canEditProducts,
  canPublishProducts,
  FIELD_LABELS,
  listWords,
  parseProductId,
  PRODUCT_FIELDS,
  stateWords,
} from "@/lib/brand-product-form";
import { canMakeItems } from "@/lib/brand-make-items";
import { loadBrand } from "@/lib/brand-request";
import { getBrandProduct } from "@/lib/brand-services";

export const metadata: Metadata = { title: "Product · TAG IT Business" };

const SAVED_WORDS: Record<string, string> = {
  "1": "Saved.",
  published: "Published. This is now the live version.",
  "no-photo": "The product was created, but its photo could not be attached. Add it below.",
};

/** One product: view it, and edit or publish it when the role allows (TAP-T17). */
export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string | string[] }>;
}) {
  const [brand, { id }, query] = await Promise.all([loadBrand(), params, searchParams]);
  if (brand === null) redirect(SIGN_IN_PATH);
  const productId = parseProductId(id);
  // Another brand's product, a wrong id and a missing one all read the same.
  const product = productId !== null ? await getBrandProduct(brand.session, productId) : null;
  if (product === null) notFound();

  const { role } = brand.session;
  const editable = canEditProducts(role) && product.state !== "archived";
  const publishable =
    canPublishProducts(role) && product.state !== "archived" && product.state !== "live";
  const saved = typeof query.saved === "string" ? SAVED_WORDS[query.saved] : undefined;

  return (
    <div className="max-w-2xl space-y-6">
      <p className="text-sm">
        <Link href="/products" className="underline">
          Products
        </Link>
      </p>
      <div className="space-y-2">
        <h1 className="break-words text-3xl font-semibold tracking-tight">{product.values.name}</h1>
        <p className="text-sm text-muted-foreground">{stateWords(product.state)}</p>
        <p className="text-sm">
          <Link href={`/products/${product.id}/items`} className="underline">
            See this product&apos;s items
          </Link>
          {canMakeItems(role) &&
          (product.state === "live" || product.state === "live-with-changes") ? (
            <>
              {" · "}
              <Link href={`/products/${product.id}/make`} className="underline">
                Make items
              </Link>
            </>
          ) : null}
        </p>
      </div>

      {saved ? (
        <p
          role="status"
          className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900"
        >
          {saved}
        </p>
      ) : null}

      {product.state === "archived" ? (
        <p className="rounded-xl border p-4 text-sm text-muted-foreground">
          This product is archived and can no longer be changed.
        </p>
      ) : (
        <section className="space-y-3 rounded-xl border p-5">
          <h2 className="font-semibold">Publishing</h2>
          <p className="text-sm text-muted-foreground">
            {product.missing.length > 0
              ? `Before it can be published, add: ${listWords(product.missing)}.`
              : product.state === "live"
                ? "The live version is up to date."
                : product.state === "live-with-changes"
                  ? "Shoppers still see the last published version. Publish to make your changes live."
                  : "Ready to publish. Until then nothing is shown to shoppers."}
          </p>
          {publishable && product.missing.length === 0 ? (
            <PublishButton
              productId={product.id}
              label={product.state === "draft" ? "Publish" : "Publish changes"}
            />
          ) : null}
          {!canPublishProducts(role) && product.state !== "live" ? (
            <p className="text-sm text-muted-foreground">A Manager of your brand publishes it.</p>
          ) : null}
        </section>
      )}

      {editable ? (
        <ProductForm
          // A fresh form after each save, so it shows what was stored.
          key={`${product.id}:${JSON.stringify(product.values)}:${product.photoUrl ?? ""}`}
          productId={product.id}
          values={product.values}
          photoUrl={product.photoUrl}
        />
      ) : (
        <dl className="divide-y rounded-xl border text-sm">
          {product.photoUrl ? (
            <div className="p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={product.photoUrl}
                alt="Product photo"
                referrerPolicy="no-referrer"
                className="h-32 w-32 rounded-lg border object-cover"
              />
            </div>
          ) : null}
          {PRODUCT_FIELDS.map((field) => (
            <div key={field} className="grid gap-1 p-4 sm:grid-cols-3">
              <dt className="text-muted-foreground">{FIELD_LABELS[field]}</dt>
              <dd className="whitespace-pre-wrap break-words sm:col-span-2">
                {product.values[field]
                  ? field === "price"
                    ? `$${product.values.price}`
                    : product.values[field]
                  : "Not set"}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
