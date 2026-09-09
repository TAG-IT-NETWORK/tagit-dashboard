import "server-only";

import { SERVICES_URL, tokenTag } from "./services";
import { parseRatingsView, type RatingsView } from "./ratings-shared";

export type { PublicRating, RatingSummary, RatingsView } from "./ratings-shared";

/** Server-side fetch with the same 60 s tag as the asset DTO. */
export async function fetchRatings(tokenId: string): Promise<RatingsView | null> {
  if (!/^\d+$/.test(tokenId)) return null;
  try {
    const res = await fetch(`${SERVICES_URL}/api/v1/assets/${tokenId}/ratings`, { headers: { accept: "application/json" }, next: { tags: [tokenTag(tokenId)], revalidate: 60 } });
    if (!res.ok) return null;
    return parseRatingsView(await res.json(), tokenId);
  } catch {
    return null;
  }
}

