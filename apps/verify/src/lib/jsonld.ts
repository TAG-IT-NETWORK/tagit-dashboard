/**
 * schema.org Product JSON-LD for asset pages — ONE block per page, matching
 * the www.tagit.network single-@graph-block convention. Pure function so the
 * offers-only-when-listed rule is unit-testable without a renderer.
 */
import type { AssetDto, AssetPrice } from "./services";

export interface ProductJsonLdInput {
  /** Canonical absolute URL of the asset page. */
  url: string;
  dto: AssetDto;
}

/** usdc6 minor units ("22000000") → schema.org price string ("22.00"). */
export function usdc6ToPriceString(priceUsdc6: string): string | null {
  if (!/^\d+$/.test(priceUsdc6)) return null;
  const padded = priceUsdc6.padStart(7, "0");
  const whole = padded.slice(0, -6);
  const cents = padded.slice(-6, -4);
  return `${whole}.${cents}`;
}

/**
 * offers ONLY when the price block is present AND the listing is live. A price
 * that is delisted, sold, or absent must not surface as a schema.org Offer —
 * search engines cache offers far longer than our 60s ISR window.
 */
export function offersForPrice(price: AssetPrice | undefined | null): object | undefined {
  if (!price) return undefined;
  if (price.saleState !== "listed") return undefined;
  if (!price.priceUsdc6) return undefined;
  const priceStr = usdc6ToPriceString(price.priceUsdc6);
  if (!priceStr) return undefined;
  return {
    "@type": "Offer",
    price: priceStr,
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
  };
}

/**
 * Build the Product JSON-LD object, or null when the page must not carry one
 * (restricted items, tokens with no product identity at all).
 */
export function buildProductJsonLd(input: ProductJsonLdInput): Record<string, unknown> | null {
  const { dto, url } = input;
  if (dto.restricted) return null; // Protected item: noindex + NO JSON-LD

  const name = dto.product?.name || dto.name;
  if (!name) return null;

  const identifier: Array<Record<string, unknown>> = [
    { "@type": "PropertyValue", propertyID: "tokenId", value: dto.tokenId },
  ];
  if (dto.tagHash) {
    identifier.push({ "@type": "PropertyValue", propertyID: "tagHash", value: dto.tagHash });
  }

  const offers = offersForPrice(dto.price);
  const gtin = dto.product?.gtin;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    url,
    ...(dto.product?.brand ? { brand: { "@type": "Brand", name: dto.product.brand } } : {}),
    ...(dto.product?.sku ? { sku: dto.product.sku } : {}),
    ...(gtin && /^\d{13}$/.test(gtin) ? { gtin13: gtin } : {}),
    ...(dto.description ? { description: dto.description } : {}),
    ...(dto.image ? { image: dto.image } : {}),
    identifier,
    ...(offers ? { offers } : {}),
  };
}
