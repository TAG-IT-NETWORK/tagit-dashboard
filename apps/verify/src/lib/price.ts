/**
 * Canonical price shape (tagit-services src/pricing/service.ts) + the browser
 * fetch helper. Client-safe: no server-only imports, no secrets — the browser
 * reads price through this host's own /api/asset/[tokenId]/price proxy.
 */

export interface CanonicalPrice {
  tokenId: string;
  priceUsdc6: string | null;
  display: string | null;
  msrp?: { amount: number; currency: string };
  saleState: "not_for_sale" | "listed" | "sold";
  version: number;
  purchase?: {
    payTo: string;
    token: string;
    chainId: number;
    settleEndpoint: string;
    /**
     * The ways to pay the server offers for this item (TAP-T13). Read through
     * offeredMethods() in ./buy-methods, never directly: a server from before
     * this field sends none, and one from after may name a way this build
     * does not know.
     */
    methods?: unknown;
    /** True when the checkout is a demo: no real money moves. */
    demo?: unknown;
  };
}

/** True when the widget may offer a purchase at this price. */
export function isPurchasable(price: CanonicalPrice | null | undefined): price is CanonicalPrice {
  return (
    !!price &&
    price.saleState === "listed" &&
    !!price.purchase &&
    !!price.priceUsdc6 &&
    /^\d+$/.test(price.priceUsdc6)
  );
}

/** usdc6 → "$22.00". */
function formatUsdc6(priceUsdc6: string): string {
  const padded = priceUsdc6.padStart(7, "0");
  return `$${padded.slice(0, -6)}.${padded.slice(-6, -4)}`;
}

/**
 * The price as the shopper reads it: the server's own `display`, and when the
 * server sent none, the same amount written out from `priceUsdc6`. Empty only
 * when there is no amount at all. One function, so the button, the sheet and
 * the wallet step can never show different prices.
 */
export function priceDisplay(price: CanonicalPrice | null | undefined): string {
  if (!price) return "";
  if (price.display) return price.display;
  return price.priceUsdc6 && /^\d+$/.test(price.priceUsdc6) ? formatUsdc6(price.priceUsdc6) : "";
}

/**
 * Live price read via this host's proxy. Returns null for "no listing"
 * (404 / NOT_AVAILABLE) AND for transport errors — the widget treats both as
 * "do not offer a purchase", which fails safe.
 */
export async function fetchPriceFromProxy(tokenId: string): Promise<CanonicalPrice | null> {
  try {
    const res = await fetch(`/api/asset/${tokenId}/price`, { cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as CanonicalPrice | { error?: string };
    if (!body || typeof body !== "object" || "error" in body) return null;
    return body as CanonicalPrice;
  } catch {
    return null;
  }
}
