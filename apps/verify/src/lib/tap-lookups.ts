import "server-only";

import { fetchRatings, type RatingsView } from "./ratings";
import { fetchAsset, type AssetLookup } from "./services";
import type { TapTimer } from "./tap-timing";

/**
 * The two tagit-services reads behind a tap page (TAP-T06).
 *
 *   product  the item record. The verdict waits for it.
 *   ratings  owner ratings. Streamed in after the verdict; nothing waits for it.
 *
 * They run ONE AFTER THE OTHER, record first. Measured against production:
 * two requests arriving at the same moment can make the platform start a
 * second copy of the services function, and whichever request lands on the new
 * copy waits about three seconds for it to boot. Asked for side by side, that
 * slow request was sometimes the record — the one the shopper is waiting on.
 * Asked for in turn, the record always gets the running copy, and ratings —
 * which the page streams in anyway — arrive a moment later.
 */
export interface TapLookups {
  product: Promise<AssetLookup>;
  ratings: Promise<RatingsView | null>;
}

export interface TapLookupSources {
  fetchAsset: (tokenId: string) => Promise<AssetLookup>;
  fetchRatings: (tokenId: string) => Promise<RatingsView | null>;
}

const SERVICES: TapLookupSources = { fetchAsset, fetchRatings };

/**
 * Start both reads for an item. Call it the moment the tag resolves to an item
 * number, so the record is on its way while the chain reads are still running.
 *
 * `ratings` never rejects, and still loads when the record lookup fails.
 */
export function startTapLookups(
  tokenId: string,
  timer: TapTimer,
  sources: TapLookupSources = SERVICES,
): TapLookups {
  const product = timer.time("product", () => sources.fetchAsset(tokenId));
  const loadRatings = () => sources.fetchRatings(tokenId);
  const ratings = product.then(loadRatings, loadRatings).catch(() => null);
  return { product, ratings };
}
