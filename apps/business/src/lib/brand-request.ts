import { cache } from "react";

import { getBrandProfile } from "@/lib/brand-services";
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
