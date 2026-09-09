/**
 * Verified-owner ratings — CLIENT-SAFE helpers (no server-only imports; the
 * rating form ships this to the browser). The signed message MUST match
 * tagit-services src/ratings/service.ts byte for byte.
 */

export interface RatingSummary {
  average: number | null;
  count: number;
  distribution: Record<"1" | "2" | "3" | "4" | "5", number>;
}
export interface PublicRating {
  id: number;
  tokenId: string;
  stars: number;
  review: string | null;
  rater: string;
  createdAt: string;
}
export interface RatingsView {
  tokenId: string;
  restricted: boolean;
  item: RatingSummary;
  product: (RatingSummary & { templateId: string }) | null;
  reviews: PublicRating[];
}

const EMPTY: RatingSummary = { average: null, count: 0, distribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 } };

export function parseRatingsView(body: unknown, tokenId: string): RatingsView {
  const b = (body ?? {}) as Record<string, unknown>;
  const sum = (v: unknown): RatingSummary => {
    const s = (v ?? {}) as Record<string, unknown>;
    return {
      average: typeof s.average === "number" ? s.average : null,
      count: typeof s.count === "number" ? s.count : 0,
      distribution: { ...EMPTY.distribution, ...((s.distribution as RatingSummary["distribution"] | undefined) ?? {}) },
    };
  };
  const product = b.product && typeof b.product === "object" ? { templateId: String((b.product as { templateId?: unknown }).templateId ?? ""), ...sum(b.product) } : null;
  const reviews = Array.isArray(b.reviews)
    ? (b.reviews as Array<Record<string, unknown>>)
        .filter((r) => typeof r?.stars === "number")
        .map((r) => ({ id: Number(r.id), tokenId: String(r.tokenId ?? tokenId), stars: r.stars as number, review: typeof r.review === "string" ? r.review : null, rater: String(r.rater ?? ""), createdAt: String(r.createdAt ?? "") }))
    : [];
  return { tokenId, restricted: b.restricted === true, item: sum(b.item), product, reviews };
}

/** SHA-256 hex of the trimmed review, "none" when empty — browser (WebCrypto) side. */
export async function reviewDigestBrowser(review: string): Promise<string> {
  const text = review.trim();
  if (!text) return "none";
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function ratingMessage(tokenId: string, stars: number, reviewDigest: string, timestamp: number): string {
  return ["TAG IT product rating", `token: ${tokenId}`, `stars: ${stars}`, `review-sha256: ${reviewDigest}`, `ts: ${timestamp}`].join("\n");
}

export function starsLabel(average: number | null): string {
  return average === null ? "no ratings yet" : `${average.toFixed(1)} / 5`;
}
