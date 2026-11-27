import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SIGN_IN_PATH } from "@/lib/access";
import { countWords, itemsWords, statusWords, type Product } from "@/lib/brand-catalog";
import { canEditProducts } from "@/lib/brand-product-form";
import { loadBrand, loadProducts } from "@/lib/brand-request";

export const metadata: Metadata = { title: "Products · TAG IT Business" };

const STATUS_STYLE: Record<Product["status"], string> = {
  published: "border-emerald-300 bg-emerald-50 text-emerald-900",
  draft: "border-border bg-muted text-foreground",
  archived: "border-border bg-transparent text-muted-foreground",
};

function ProductRow({ product }: { product: Product }) {
  const details = [product.model, product.sku ? `SKU ${product.sku}` : null, product.category]
    .filter((part): part is string => part !== null && part !== product.name)
    .join(" · ");
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="break-words font-medium">
            <Link href={`/products/${product.id}`} className="underline-offset-4 hover:underline">
              {product.name}
            </Link>
          </h2>
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[product.status]}`}
          >
            {statusWords(product.status)}
          </span>
        </div>
        {details ? (
          <p className="mt-1 break-words text-sm text-muted-foreground">{details}</p>
        ) : null}
      </div>
      <dl className="flex shrink-0 gap-8 text-sm sm:text-right">
        <div>
          <dt className="text-xs text-muted-foreground">Price</dt>
          <dd className="tabular-nums">{product.price ?? "Not set"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Made</dt>
          <dd className="tabular-nums">{itemsWords(product.items)}</dd>
        </div>
      </dl>
    </li>
  );
}

/** The brand's own products (TAP-T17). Editors and Managers can add one. */
export default async function BrandProductsPage() {
  // Both reads start together: a slow services answer is waited for once.
  const [brand, list] = await Promise.all([loadBrand(), loadProducts()]);
  if (brand === null || list === null) redirect(SIGN_IN_PATH);
  const canAdd = canEditProducts(brand.session.role);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground">
            {list.loaded
              ? `${countWords(list.products.length, "product", "products")} in ${brand.profile.name}'s catalog.`
              : "Your catalog."}
          </p>
        </div>
        {canAdd ? (
          <Link
            href="/products/new"
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            New product
          </Link>
        ) : null}
      </div>

      {!list.loaded ? (
        <p role="alert" className="rounded-xl border p-6 text-sm">
          Your products could not be loaded just now. Refresh the page in a moment.
        </p>
      ) : list.products.length === 0 ? (
        <p className="rounded-xl border p-6 text-sm text-muted-foreground">
          {canAdd
            ? "No products yet. Add your first one with New product."
            : "No products yet. An Editor or Manager of your brand can add the first one."}
        </p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {list.products.map((product) => (
            <ProductRow key={product.id} product={product} />
          ))}
        </ul>
      )}
    </div>
  );
}
