/**
 * What one keep-warm run touches (see src/app/api/warm/route.ts).
 *
 * Kept out of the route file because a Next route module may only export HTTP
 * handlers and segment config, and so the list can be unit-tested.
 */

/**
 * A syntactically valid but wrong tap payload. Both tap probes take the
 * "could not verify" branch with it: no chain read, no tap counter touched,
 * nothing cached.
 */
export const WARM_TAP_QUERY = "picc=00112233445566778899aabbccddeeff&cmac=0011223344556677";

export interface WarmConfig {
  /** This app's own origin, e.g. https://verify.tagit.network */
  self: string;
  /** tagit-services origin. */
  services: string;
  /** An item that exists, used for the price proxy and the item record. */
  tokenId: string;
}

/**
 * The URLs to probe, in order:
 *
 *   /sun                 the tap page function
 *   /api/verify          the same check as JSON — what the TAG IT app calls
 *   /api/asset/:id/price the price proxy the buy widget calls
 *   services item record the LEAN view, the one a tap reads
 *
 * The services probe carries a throwaway `warm` value so the request reaches
 * the function: an answer served from the edge cache would warm nothing.
 */
export function warmTargets(config: WarmConfig, now: number = Date.now()): string[] {
  return [
    `${config.self}/sun?${WARM_TAP_QUERY}`,
    `${config.self}/api/verify?${WARM_TAP_QUERY}`,
    `${config.self}/api/asset/${config.tokenId}/price`,
    `${config.services}/api/v1/assets/${config.tokenId}?currency=EUR&view=lean&warm=${now}`,
  ];
}
