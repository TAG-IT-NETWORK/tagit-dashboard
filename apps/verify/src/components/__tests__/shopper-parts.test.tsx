import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { COPY } from "@/lib/consumer-copy";
import type { ProvenanceWireEvent } from "@/lib/provenance-wire";
import { RATINGS, REVIEWER } from "@/test-support/shopper-fixtures";
import { readable } from "@/test-support/readable";

import { historyLabel, historySteps } from "../provenance-timeline";
import { RatingSummary, ReviewsSection, Stars, reviewDay, starFill } from "../rating-summary";

/** TAP-T08: product history and owner reviews, in the shopper's words. */

let n = 0;
const event = (
  type: ProvenanceWireEvent["type"],
  from?: string,
  to?: string,
): ProvenanceWireEvent => ({
  type,
  block_number: 100 + ++n,
  log_index: 0,
  transaction_hash: `0x${"a1".repeat(32)}`,
  ...(from ? { from_state: from } : {}),
  ...(to ? { to_state: to } : {}),
});

const LIFE = [
  event("AssetMinted"),
  event("StateChanged", "NONE", "MINTED"),
  event("TagBound"),
  event("StateChanged", "MINTED", "BOUND"),
  event("StateChanged", "BOUND", "ACTIVATED"),
  event("StateChanged", "ACTIVATED", "CLAIMED"),
];

describe("product history", () => {
  it("tells an item's life as made, tag attached, released, bought", () => {
    expect(historySteps(LIFE, "TAG IT Demo")).toEqual([
      "Made and registered by TAG IT Demo",
      "Tag attached",
      "Released for sale",
      "Bought and registered to its owner",
    ]);
    expect(historySteps(LIFE)[0]).toBe("Made and registered");
  });

  it("shows no state name, block number or transaction", () => {
    const text = historySteps(
      [
        ...LIFE,
        event("StateChanged", "CLAIMED", "FLAGGED"),
        event("StateChanged", "FLAGGED", "CLAIMED"),
        event("AssetResold"),
        event("StateChanged", "CLAIMED", "RECYCLED"),
      ],
      "TAG IT Demo",
    ).join("\n");
    expect(text).not.toMatch(/\b(NONE|MINTED|BOUND|ACTIVATED|CLAIMED|FLAGGED|RECYCLED)\b/);
    expect(text).not.toMatch(/0x|\d{3}/);
  });

  it("words a report, its closing, a resale and a retirement", () => {
    expect(historyLabel(event("StateChanged", "CLAIMED", "FLAGGED"))).toBe(COPY.history.reported);
    // back from a report is the report closing, not a second purchase
    expect(historyLabel(event("StateChanged", "FLAGGED", "CLAIMED"))).toBe(
      COPY.history.reportClosed,
    );
    expect(historyLabel(event("AssetResold"))).toBe(COPY.history.resold);
    expect(historyLabel(event("StateChanged", "CLAIMED", "RECYCLED"))).toBe(COPY.history.retired);
  });

  it("does not repeat the making or the attaching through their state changes", () => {
    expect(historyLabel(event("StateChanged", "NONE", "MINTED"))).toBeNull();
    expect(historyLabel(event("StateChanged", "MINTED", "BOUND"))).toBeNull();
  });

  it("calls a change it does not know an update, never a guess", () => {
    expect(historyLabel(event("StateChanged", "CLAIMED", "SOMETHING_NEW"))).toBe(
      COPY.history.updated,
    );
    expect(historyLabel(event("StateChanged"))).toBe(COPY.history.updated);
  });

  it("does not say the same step twice in a row", () => {
    expect(historySteps([event("TagBound"), event("TagBound"), event("AssetResold")])).toEqual([
      COPY.history.tagAttached,
      COPY.history.resold,
    ]);
    expect(historySteps([])).toEqual([]);
  });
});

describe("stars", () => {
  const row = (value: number) => [1, 2, 3, 4, 5].map((i) => starFill(value, i)).join(" ");

  it("fills to the nearest half", () => {
    expect(row(5)).toBe("full full full full full");
    expect(row(4.5)).toBe("full full full full half");
    expect(row(4.4)).toBe("full full full full half");
    expect(row(4.2)).toBe("full full full full none");
    expect(row(3.75)).toBe("full full full full none");
    expect(row(0.4)).toBe("half none none none none");
    expect(row(0)).toBe("none none none none none");
  });

  it("spells the value out for people who cannot see the drawing", () => {
    expect(renderToStaticMarkup(<Stars value={4.5} />)).toContain(
      'role="img" aria-label="4.5 out of 5 stars"',
    );
    expect(renderToStaticMarkup(<Stars value={null} />)).toContain(
      `aria-label="${COPY.reviews.none}"`,
    );
  });
});

describe("owner reviews", () => {
  it("shows the product's average, the count and the latest reviews", () => {
    const text = readable(renderToStaticMarkup(<ReviewsSection view={RATINGS} />));
    expect(text).toContain(`## ${COPY.reviews.title}`);
    expect(text).toContain("4.5");
    expect(text).toContain("2 verified owner reviews");
    expect(text).toContain(COPY.reviews.onlyOwners);
    expect(text).toContain("Verified owner Oct 12, 2026");
    expect(text).toContain("Soaks in fast and lasts all day.");
  });

  it("never shows who wrote a review", () => {
    const html = renderToStaticMarkup(<RatingSummary view={RATINGS} />);
    expect(html).not.toContain(REVIEWER);
    expect(html).not.toMatch(/0x/);
  });

  it("says so when there are no reviews yet", () => {
    const empty = { ...RATINGS, product: null, reviews: [] };
    expect(readable(renderToStaticMarkup(<RatingSummary view={empty} />))).toContain(
      COPY.reviews.none,
    );
  });

  it("is left out as a whole for a private item or a failed read: no empty heading", () => {
    expect(renderToStaticMarkup(<ReviewsSection view={null} />)).toBe("");
    expect(renderToStaticMarkup(<ReviewsSection view={{ ...RATINGS, restricted: true }} />)).toBe(
      "",
    );
  });

  it("writes a review's day the same wherever the server runs", () => {
    const original = process.env.TZ;
    try {
      for (const zone of ["Pacific/Kiritimati", "Pacific/Pago_Pago"]) {
        process.env.TZ = zone;
        expect(reviewDay("2026-12-31T23:59:59.000Z")).toBe("Dec 31, 2026");
        expect(reviewDay("2027-01-01T00:00:01.000Z")).toBe("Jan 1, 2027");
      }
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });

  it("writes a review's day, and leaves out a date it cannot read", () => {
    expect(reviewDay("2026-10-12T08:00:00.000Z")).toBe("Oct 12, 2026");
    expect(reviewDay("not a date")).toBeNull();
    const odd = { ...RATINGS, reviews: [{ ...RATINGS.reviews[0]!, createdAt: "not a date" }] };
    expect(renderToStaticMarkup(<RatingSummary view={odd} />)).not.toContain("<time");
  });
});
