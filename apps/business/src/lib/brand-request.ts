import { cache } from "react";

import type { ItemCounts, ProductList } from "@/lib/brand-catalog";
import { getBrandProducts, getBrandProfile, getBrandSummary } from "@/lib/brand-services";
import { getBrandSession, type BrandSession } from "@/lib/brand-session";
import type { BrandProfile } from "@/lib/brand-view";

/**
 * The signed-in brand for THIS request: the session and the brand's record,
 * read once and shared by the layout and the page. Null means "not a brand
 * session"; the caller must then refuse to render.
 */
export const loadBrand = cache(
  async (): Promise<{ session: BrandSession; profile: BrandProfile } | null> => {
    const session = await getBrandSession();
    if (session === null) return null;
    return { session, profile: await getBrandProfile(session) };
  },
);

/**
 * The signed-in brand's products and item counts for THIS request. They take
 * no argument on purpose: the brand always comes from the session, so a page
 * cannot ask for another brand's. Null means "not a brand session".
 */
export const loadProducts = cache(async (): Promise<ProductList | null> => {
  const session = await getBrandSession();
  return session === null ? null : getBrandProducts(session);
});

export const loadItemCounts = cache(async (): Promise<ItemCounts | null> => {
  const session = await getBrandSession();
  return session === null ? null : getBrandSummary(session);
});
