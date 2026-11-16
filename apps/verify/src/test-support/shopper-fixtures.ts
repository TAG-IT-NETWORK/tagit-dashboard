/**
 * Made-up data for the shopper-page tests (TAP-T08). It deliberately carries
 * the things a shopper page must never show — an owner address, a seller
 * address, a reviewer address, the reason a check failed — so the tests can
 * prove they are not shown.
 */
import type { RatingsView } from "@/lib/ratings-shared";
import type { TapResolution } from "@/lib/resolve";
import type { AssetDto, AssetLookup } from "@/lib/services";

/** The item's owner. Must appear NOWHERE on a shopper page. */
export const OWNER = "0x1234567890abcdef1234567890ABCDEF12345678";
/** The same owner, the way the item record abbreviates it. */
export const OWNER_SHORT = "0x1234…5678";
/** Where a buyer's payment goes. Not for the page either. */
export const SELLER = "0x2222222222222222222222222222222222222222";
/** A reviewer, as the ratings service identifies them. */
export const REVIEWER = "0x3333…3333";

export const TAG_UID = "04A1B2C3D4E5F6";
export const TAG_ID_SHOWN = "04:A1:B2:C3:D4:E5:F6";
export const RECORD_NUMBER = "58";
export const FINGERPRINT = `0x${"ab".repeat(32)}`;

/** What the server knows about a failure. The shopper is not told. */
export const FAIL_REASON = "cmac mismatch";
export const LOOKUP_ERROR = "Asset read failed.";

export const STATE = {
  MINTED: 1,
  BOUND: 2,
  ACTIVATED: 3,
  CLAIMED: 4,
  FLAGGED: 5,
  RECYCLED: 6,
} as const;

/** A tap that led to item 58 in the given lifecycle state. */
export function resolvedTap(state: number): TapResolution {
  return {
    kind: "resolved",
    uid: TAG_UID,
    counter: 42,
    tokenId: 58n,
    asset: { owner: OWNER, timestamp: 1_788_600_600n, state, flags: 0, reserved: 0 },
    metadataHash: FINGERPRINT as `0x${string}`,
  };
}

export const FAILED_TAP: TapResolution = { kind: "counterfeit", reason: FAIL_REASON };
export const UNLINKED_TAP: TapResolution = { kind: "authentic-unbound", uid: TAG_UID, counter: 42 };
export const BROKEN_LOOKUP_TAP: TapResolution = {
  kind: "lookup-failed",
  uid: TAG_UID,
  counter: 42,
  reason: LOOKUP_ERROR,
};

const VERIFIED = {
  anchoredVersion: 2,
  latestVersion: 2,
  anchorStatus: "confirmed",
  metadataHash: FINGERPRINT,
  verified: true,
};

/** The item record for item 58, in a given state, listed for sale or not. */
export function recordDto(stateCode: number, listed = false): AssetDto {
  return {
    tokenId: RECORD_NUMBER,
    owner: OWNER_SHORT,
    stateCode,
    lifecycleState: ["NONE", "MINTED", "BOUND", "ACTIVATED", "CLAIMED", "FLAGGED", "RECYCLED"][
      stateCode
    ],
    name: "Renewal Cream",
    timestamp: 1_788_600_600, // 2026-09-05 UTC
    description: "A light daily face cream for dry skin. 50 ml jar.",
    tagHash: `0x${"cd".repeat(32)}`,
    flags: 0,
    product: {
      name: "Renewal Cream",
      brand: "TAG IT Demo",
      model: "Renewal Cream",
      sku: "TD-RC-50",
      origin: "KR",
      category: "Cosmetics",
    },
    media: [
      { role: "hero", url: "https://media.tagit.network/i/abc123/lg.webp", mime: "image/webp" },
    ],
    price: listed
      ? {
          tokenId: RECORD_NUMBER,
          priceUsdc6: "23330000",
          display: "$23.33",
          saleState: "listed",
          version: 2,
          fx: { currency: "EUR", approx: "21.11" },
          purchase: {
            payTo: SELLER,
            token: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
            chainId: 84532,
            settleEndpoint: "/api/v1/sale/settle",
          },
        }
      : {
          tokenId: RECORD_NUMBER,
          priceUsdc6: null,
          display: null,
          saleState: "not_for_sale",
          version: 1,
        },
    verification: VERIFIED,
  };
}

export const record = (stateCode: number, listed = false): AssetLookup => ({
  kind: "record",
  dto: recordDto(stateCode, listed),
});

export const RESTRICTED: AssetLookup = {
  kind: "restricted",
  dto: { tokenId: RECORD_NUMBER, restricted: true, name: "TAG IT Protected Asset" },
};

export const RATINGS: RatingsView = {
  tokenId: RECORD_NUMBER,
  restricted: false,
  item: { average: null, count: 0, distribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 } },
  product: {
    templateId: "tpl_test",
    average: 4.5,
    count: 2,
    distribution: { "1": 0, "2": 0, "3": 0, "4": 1, "5": 1 },
  },
  reviews: [
    {
      id: 1,
      tokenId: RECORD_NUMBER,
      stars: 5,
      review: "Soaks in fast and lasts all day.",
      rater: REVIEWER,
      createdAt: "2026-10-12T08:00:00.000Z",
    },
  ],
};
