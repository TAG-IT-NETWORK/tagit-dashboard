import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ProductForm } from "@/components/product-form";
import { SIGN_IN_PATH } from "@/lib/access";
import { canEditProducts, EMPTY_PRODUCT } from "@/lib/brand-product-form";
import { loadBrand } from "@/lib/brand-request";

export const metadata: Metadata = { title: "New product · TAG IT Business" };

/** Create a product (TAP-T17, brand editing). Editors and Managers. */
export default async function NewProductPage() {
  const brand = await loadBrand();
  if (brand === null) redirect(SIGN_IN_PATH);
  // The gate already keeps a View-only account out; this is the second check.
  if (!canEditProducts(brand.session.role)) redirect("/products");

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">New product</h1>
        <p className="text-sm text-muted-foreground">
          It is saved as a draft. Nothing is shown to shoppers until a Manager publishes it.
        </p>
      </div>
      <ProductForm productId={null} values={{ ...EMPTY_PRODUCT }} photoUrl={null} />
    </div>
  );
}
