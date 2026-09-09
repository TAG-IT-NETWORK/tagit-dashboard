import { describe, expect, it } from "vitest";

import { parseRatingsView, ratingMessage, starsLabel } from "../ratings";

describe("ratings helpers", () => {
  it("builds the exact canonical message the services verify", () => {
    // Fixture shared with tagit-services src/ratings/__tests__/ratings.test.ts
    expect(ratingMessage("56", 5, "none", 1757400000000)).toBe("TAG IT product rating\ntoken: 56\nstars: 5\nreview-sha256: none\nts: 1757400000000");
  });
  it("parses the view tolerantly", () => {
    const v = parseRatingsView({ item: { average: 4.5, count: 2, distribution: { "5": 1, "4": 1 } }, product: { templateId: "tpl_1", average: 4.2, count: 9 }, reviews: [{ id: 1, tokenId: "56", stars: 5, review: "x", rater: "0x12…ab", createdAt: "2026-09-09T10:00:00Z" }, { bogus: true }] }, "56");
    expect(v.item.average).toBe(4.5);
    expect(v.item.distribution["3"]).toBe(0);
    expect(v.product?.count).toBe(9);
    expect(v.reviews).toHaveLength(1);
    expect(parseRatingsView(null, "1")).toMatchObject({ restricted: false, item: { count: 0 }, product: null, reviews: [] });
    expect(starsLabel(null)).toBe("no ratings yet");
    expect(starsLabel(4.25)).toBe("4.3 / 5");
  });
});
