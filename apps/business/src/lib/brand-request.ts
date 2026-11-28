import { cache } from "react";

import type { ItemCounts, ProductList } from "@/lib/brand-catalog";
import type { TapNumbers } from "@/lib/brand-numbers";
import {
  getBrandProducts,
  getBrandProfile,
  getBrandSummary,
  getBrandTaps,
} from "@/lib/brand-services";
import { getBrandSession, type BrandSession } from "@/lib/brand-session";
import type { BrandProfile } from "@/lib/brand-view";

/** The session for THIS request, read once however many parts ask. */
const loadSession = cache(async (): Promise<BrandSession | null> => getBrandSession());

/**
 * The signed-in brand for THIS request: the session and the brand's record,
 * read once and shared by the layout and the page. Null means "not a brand
 * session"; the caller must then refuse to render.
 */
export const loadBrand = cache(
  async (): Promise<{ session: BrandSession; profile: BrandProfile } | null> => {
    const session = await loadSession();
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
  const session = await loadSession();
  return session === null ? null : getBrandProducts(session);
});

export const loadItemCounts = cache(async (): Promise<ItemCounts | null> => {
  const session = await loadSession();
  return session === null ? null : getBrandSummary(session);
});

/** The signed-in brand's tap numbers (TAP-T18). Null: not a brand session, or not readable. */
export const loadTaps = cache(async (): Promise<TapNumbers | null> => {
  const session = await loadSession();
  return session === null ? null : getBrandTaps(session);
});
