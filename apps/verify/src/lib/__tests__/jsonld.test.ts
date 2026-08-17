import { describe, it, expect } from "vitest";
import { buildProductJsonLd, offersForPrice, usdc6ToPriceString } from "../jsonld";
import type { AssetDto, AssetPrice } from "../services";

const listedPrice: AssetPrice = {
  tokenId: "5",
  priceUsdc6: "22000000",
  display: "$22.00",
  saleState: "listed",
  version: 3,
  purchase: {
    payTo: "0x458B4d0c3a55006965Fd13D6af7B8509De51Cb3D",
    token: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    chainId: 84532,
    settleEndpoint: "/api/v1/sale/settle",
  },
};

function dto(overrides: Partial<AssetDto> = {}): AssetDto {
  return {
    tokenId: "5",
    stateCode: 4,
    name: "PDRN Capsule Cream 100",
    description: "A cream.",
    image: "https://media.tagit.network/i/" + "a".repeat(64) + "/lg.webp",
    tagHash: "0x" + "b".repeat(64),
    product: {
      name: "PDRN Capsule Cream 100",
      brand: "TAG IT",
      sku: "PDRN-100",
      gtin: "1234567890123",
    },
    verification: {
      anchoredVersion: 1,
      latestVersion: 1,
      anchorStatus: "confirmed",
      metadataHash: "0x" + "c".repeat(64),
      verified: true,
    },
    ...overrides,
  };
}

describe("usdc6ToPriceString", () => {
  it("converts minor units to a 2-decimal price string", () => {
    expect(usdc6ToPriceString("22000000")).toBe("22.00");
    expect(usdc6ToPriceString("199990000")).toBe("199.99");
    expect(usdc6ToPriceString("500000")).toBe("0.50");
  });
  it("rejects non-numeric input", () => {
    expect(usdc6ToPriceString("22.00")).toBeNull();
    expect(usdc6ToPriceString("")).toBeNull();
  });
});

describe("offersForPrice — offers ONLY when a live listing exists", () => {
  it("emits an Offer for a listed price", () => {
    expect(offersForPrice(listedPrice)).toEqual({
      "@type": "Offer",
      price: "22.00",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    });
  });

  it("emits NOTHING when there is no price block", () => {
    expect(offersForPrice(undefined)).toBeUndefined();
    expect(offersForPrice(null)).toBeUndefined();
  });

  it("emits NOTHING when the listing is not live", () => {
    expect(offersForPrice({ ...listedPrice, saleState: "not_for_sale" })).toBeUndefined();
    expect(offersForPrice({ ...listedPrice, saleState: "sold" })).toBeUndefined();
    expect(offersForPrice({ ...listedPrice, priceUsdc6: null })).toBeUndefined();
  });
});

describe("buildProductJsonLd", () => {
  const url = "https://verify.tagit.network/asset/5";

  it("builds a single Product block with brand/sku/gtin13 and identifier PropertyValues", () => {
    const ld = buildProductJsonLd({ url, dto: dto({ price: listedPrice }) });
    expect(ld).not.toBeNull();
    expect(ld!["@type"]).toBe("Product");
    expect(ld!.name).toBe("PDRN Capsule Cream 100");
    expect(ld!.brand).toEqual({ "@type": "Brand", name: "TAG IT" });
    expect(ld!.sku).toBe("PDRN-100");
    expect(ld!.gtin13).toBe("1234567890123");
    expect(ld!.identifier).toEqual([
      { "@type": "PropertyValue", propertyID: "tokenId", value: "5" },
      { "@type": "PropertyValue", propertyID: "tagHash", value: "0x" + "b".repeat(64) },
    ]);
    expect(ld!.offers).toBeDefined();
  });

  it("omits offers when the price block is missing or not listed", () => {
    expect(buildProductJsonLd({ url, dto: dto() })!.offers).toBeUndefined();
    expect(
      buildProductJsonLd({ url, dto: dto({ price: { ...listedPrice, saleState: "sold" } }) })!
        .offers,
    ).toBeUndefined();
  });

  it("omits gtin13 when the gtin is not 13 digits", () => {
    const d = dto();
    d.product = { ...d.product, gtin: "123" };
    expect(buildProductJsonLd({ url, dto: d })!.gtin13).toBeUndefined();
  });

  it("returns null for restricted items (Protected item pages carry NO JSON-LD)", () => {
    expect(buildProductJsonLd({ url, dto: dto({ restricted: true }) })).toBeNull();
  });

  it("returns null when there is no product name at all", () => {
    expect(
      buildProductJsonLd({ url, dto: dto({ name: undefined, product: undefined }) }),
    ).toBeNull();
  });
});
