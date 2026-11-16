import { describe, expect, it } from "vitest";

import { COPY, TAP_STATES, type TapStateKey } from "../consumer-copy";
import type { TapResolution } from "../resolve";
import type { AssetLookup } from "../services";
import {
  chipsFor,
  detailsCheckLabel,
  detailsCheckOf,
  formatDay,
  hasProductToShow,
  historyStatusOf,
  isAuthenticTapState,
  placeName,
  productViewOf,
  recordChips,
  recordFactsOf,
  recordHistoryStatus,
  recordStateFor,
  shownTagId,
  tapStateFor,
} from "../tap-view";
import {
  BROKEN_LOOKUP_TAP,
  FAILED_TAP,
  OWNER,
  OWNER_SHORT,
  RESTRICTED,
  SELLER,
  STATE,
  UNLINKED_TAP,
  record,
  recordDto,
  resolvedTap,
} from "../../test-support/shopper-fixtures";

/**
 * TAP-T08: which approved state a finished check lands in, and which product
 * facts the page is given. These functions only choose words for a result that
 * lib/resolve.ts already decided.
 */

const ANY_RECORD = [
  { restricted: false, listed: false },
  { restricted: false, listed: true },
  { restricted: true, listed: false },
  { restricted: true, listed: true },
];

describe("tapStateFor", () => {
  it.each<[string, TapResolution, TapStateKey]>([
    ["a link with parts missing", { kind: "bad-params" }, "linkIncomplete"],
    ["a check that did not pass", FAILED_TAP, "checkFailed"],
    ["a genuine tag with no item", UNLINKED_TAP, "noProduct"],
    ["a lookup that failed", BROKEN_LOOKUP_TAP, "ourSide"],
    ["a server that is not set up", { kind: "not-configured" }, "ourSide"],
  ])("%s is the same state whatever the record says", (_name, res, expected) => {
    for (const facts of ANY_RECORD) expect(tapStateFor(res, facts)).toBe(expected);
  });

  it("never turns anything but a resolved tap into an authentic state", () => {
    const notResolved: TapResolution[] = [
      { kind: "bad-params" },
      { kind: "not-configured" },
      FAILED_TAP,
      UNLINKED_TAP,
      BROKEN_LOOKUP_TAP,
    ];
    for (const res of notResolved) {
      for (const facts of ANY_RECORD) {
        const state = tapStateFor(res, facts);
        expect(isAuthenticTapState(state)).toBe(false);
        expect(TAP_STATES[state].headline).not.toBe("Authentic");
      }
    }
  });

  it.each<[number, boolean, boolean, TapStateKey]>([
    // state, restricted, listed → shown as
    [STATE.ACTIVATED, false, true, "newForSale"],
    [STATE.ACTIVATED, false, false, "newNotForSale"],
    [STATE.CLAIMED, false, false, "owned"],
    // a listing on an owned item does not make it "new"
    [STATE.CLAIMED, false, true, "owned"],
    [STATE.MINTED, false, false, "notReleased"],
    [STATE.BOUND, false, false, "notReleased"],
    [STATE.FLAGGED, false, false, "reported"],
    [STATE.RECYCLED, false, false, "retired"],
    [STATE.ACTIVATED, true, false, "privateItem"],
    [STATE.CLAIMED, true, false, "privateItem"],
    // a warning about the item wins over the owner's privacy
    [STATE.FLAGGED, true, false, "reported"],
    [STATE.RECYCLED, true, false, "retired"],
    [STATE.BOUND, true, false, "notReleased"],
    // a tag that points at an empty or unknown record is not a product
    [0, false, false, "noProduct"],
    [9, false, true, "noProduct"],
  ])("resolved, state %i, restricted %s, listed %s → %s", (state, restricted, listed, expected) => {
    expect(tapStateFor(resolvedTap(state), { restricted, listed })).toBe(expected);
  });

  it("says Authentic only for an item that is released and not reported or retired", () => {
    for (let state = 0; state <= 9; state++) {
      for (const facts of ANY_RECORD) {
        const key = tapStateFor(resolvedTap(state), facts);
        const released = state === STATE.ACTIVATED || state === STATE.CLAIMED;
        expect(TAP_STATES[key].headline === "Authentic").toBe(released);
        expect(isAuthenticTapState(key)).toBe(released);
      }
    }
  });
});

describe("recordStateFor", () => {
  it.each<[string, AssetLookup | { kind: "invalid" }, string]>([
    ["a link that is not a number", { kind: "invalid" }, "notANumber"],
    ["a record service that is down", { kind: "unavailable" }, "notLoaded"],
    ["no record", { kind: "none" }, "noRecord"],
    ["a private item", RESTRICTED, "privateItem"],
    ["a new item", record(STATE.ACTIVATED), "registered"],
    ["an owned item", record(STATE.CLAIMED), "registered"],
    ["an item not yet released", record(STATE.BOUND), "notReleased"],
    ["a just-made item", record(STATE.MINTED), "notReleased"],
    ["a reported item", record(STATE.FLAGGED), "reported"],
    ["a retired item", record(STATE.RECYCLED), "retired"],
    ["an empty record", record(0), "noRecord"],
  ])("%s", (_name, lookup, expected) => {
    expect(recordStateFor(lookup)).toBe(expected);
  });

  it("treats a record with no state as no record", () => {
    const dto = recordDto(STATE.ACTIVATED);
    delete dto.stateCode;
    expect(recordStateFor({ kind: "record", dto })).toBe("noRecord");
  });
});

describe("status chips", () => {
  it("after a tap", () => {
    expect(chipsFor("newForSale")).toEqual([COPY.chips.isNew, COPY.chips.forSale]);
    expect(chipsFor("newNotForSale")).toEqual([COPY.chips.isNew]);
    expect(chipsFor("owned")).toEqual([COPY.chips.owned]);
    expect(chipsFor("notReleased")).toEqual([COPY.chips.notReleased]);
    expect(chipsFor("reported")).toEqual([COPY.chips.reported]);
    expect(chipsFor("retired")).toEqual([COPY.chips.retired]);
    for (const state of [
      "privateItem",
      "checkFailed",
      "linkUsed",
      "noProduct",
      "ourSide",
      "linkIncomplete",
    ] as const) {
      expect(chipsFor(state)).toEqual([]);
    }
  });

  it("on the record page", () => {
    expect(recordChips(STATE.ACTIVATED, true)).toEqual([COPY.chips.isNew, COPY.chips.forSale]);
    expect(recordChips(STATE.ACTIVATED, false)).toEqual([COPY.chips.isNew]);
    expect(recordChips(STATE.CLAIMED, true)).toEqual([COPY.chips.owned, COPY.chips.forSale]);
    expect(recordChips(STATE.CLAIMED, false)).toEqual([COPY.chips.owned]);
    // "For sale" is never added to an item that cannot be bought
    expect(recordChips(STATE.BOUND, true)).toEqual([COPY.chips.notReleased]);
    expect(recordChips(STATE.FLAGGED, true)).toEqual([COPY.chips.reported]);
    expect(recordChips(STATE.RECYCLED, true)).toEqual([COPY.chips.retired]);
    expect(recordChips(0, true)).toEqual([]);
    expect(recordChips(undefined, false)).toEqual([]);
  });
});

describe("placeName", () => {
  it("writes a country code out", () => {
    expect(placeName("KR")).toBe("South Korea");
    expect(placeName("kr")).toBe("South Korea");
    expect(placeName(" IT ")).toBe("Italy");
  });

  it("keeps anything else as the brand wrote it", () => {
    expect(placeName("Made in Jeju")).toBe("Made in Jeju");
    expect(placeName("Italy")).toBe("Italy");
    // not country codes: shown as written, never as "Unknown Region"
    expect(placeName("ZZ")).toBe("ZZ");
    expect(placeName("QQ")).toBe("QQ");
  });

  it("gives nothing for nothing", () => {
    expect(placeName(undefined)).toBeUndefined();
    expect(placeName(null)).toBeUndefined();
    expect(placeName("   ")).toBeUndefined();
  });
});

describe("shownTagId", () => {
  it("writes a tag ID from a link in pairs", () => {
    expect(shownTagId("04A1B2C3D4E5F6")).toBe("04:A1:B2:C3:D4:E5:F6");
    expect(shownTagId("04:a1:b2:c3:d4:e5:f6")).toBe("04:A1:B2:C3:D4:E5:F6");
    expect(shownTagId("04-a1-b2-c3")).toBe("04:A1:B2:C3");
  });

  it("shows nothing back that is not shaped like a tag ID", () => {
    for (const text of [
      "hello-world",
      "<script>alert(1)</script>",
      "04A1B2C", // half a byte
      "04A1B2", // too short
      "04".repeat(11), // too long
      "",
      "0x04A1B2C3D4E5F6",
      "javascript:alert(1)",
    ]) {
      expect(shownTagId(text)).toBeNull();
    }
  });
});

describe("formatDay", () => {
  it("writes a day in UTC", () => {
    expect(formatDay(1_788_600_600)).toBe("Sep 5, 2026");
    // 23:59:59 UTC on Dec 31 stays Dec 31 for every reader
    expect(formatDay(Date.UTC(2026, 11, 31, 23, 59, 59) / 1000)).toBe("Dec 31, 2026");
  });

  it("reads the same wherever the server runs", () => {
    const original = process.env.TZ;
    try {
      // 14 hours ahead of UTC, then 11 hours behind
      for (const zone of ["Pacific/Kiritimati", "Pacific/Pago_Pago"]) {
        process.env.TZ = zone;
        expect(formatDay(Date.UTC(2026, 11, 31, 23, 59, 59) / 1000)).toBe("Dec 31, 2026");
        expect(formatDay(Date.UTC(2027, 0, 1, 0, 0, 1) / 1000)).toBe("Jan 1, 2027");
      }
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });

  it("gives nothing for a missing or impossible time", () => {
    for (const bad of [undefined, null, 0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(formatDay(bad)).toBeUndefined();
    }
  });
});

describe("productViewOf", () => {
  it("takes what the record carries, written for a shopper", () => {
    expect(productViewOf(record(STATE.ACTIVATED, true))).toEqual({
      name: "Renewal Cream",
      named: true,
      brand: "TAG IT Demo",
      madeIn: "South Korea",
      code: "TD-RC-50",
      description: "A light daily face cream for dry skin. 50 ml jar.",
      price: "$23.33",
      fx: { text: "≈ €21.11", ariaLabel: expect.any(String) },
      updatedOn: "Sep 5, 2026",
      photo: { url: "https://media.tagit.network/i/abc123/lg.webp" },
    });
  });

  it("calls the record's date the last update, not a registration date", () => {
    // The registry rewrites the timestamp on every change. For an owned item
    // it is the day it was bought: here the item was bought on Oct 8, weeks
    // after it was made and registered.
    const bought = Date.UTC(2026, 9, 8, 17, 47) / 1000;
    const owned = record(STATE.CLAIMED);
    if (owned.kind !== "record") throw new Error("fixture");
    const view = productViewOf({ kind: "record", dto: { ...owned.dto, timestamp: bought } });
    expect(view.updatedOn).toBe("Oct 8, 2026");
    expect(view).not.toHaveProperty("registeredOn");
  });

  it("has no field that could hold the owner or the seller", () => {
    for (const lookup of [record(STATE.ACTIVATED, true), record(STATE.CLAIMED), RESTRICTED]) {
      const json = JSON.stringify(productViewOf(lookup));
      for (const secret of [OWNER, OWNER_SHORT, OWNER.slice(0, 8), SELLER, "0x"]) {
        expect(json).not.toContain(secret);
      }
    }
  });

  it("gives a price only for a live listing", () => {
    expect(productViewOf(record(STATE.ACTIVATED)).price).toBeUndefined();
    expect(productViewOf(record(STATE.ACTIVATED)).fx).toBeUndefined();

    // a price left on a record that is no longer listed is not a price
    const sold = recordDto(STATE.CLAIMED, true);
    sold.price = { ...sold.price!, saleState: "sold" };
    const view = productViewOf({ kind: "record", dto: sold });
    expect(view.price).toBeUndefined();
    expect(view.fx).toBeUndefined();
  });

  it("gives only the neutral name for a private, missing or unloaded record", () => {
    const fallback = { name: COPY.product.fallbackName, named: false };
    expect(productViewOf(RESTRICTED)).toEqual(fallback);
    expect(productViewOf({ kind: "none" })).toEqual(fallback);
    expect(productViewOf({ kind: "unavailable" })).toEqual(fallback);
    expect(productViewOf(null)).toEqual(fallback);
    expect(productViewOf(undefined)).toEqual(fallback);
  });

  it("drops a model that only repeats the name, keeps one that adds something", () => {
    expect(productViewOf(record(STATE.ACTIVATED)).model).toBeUndefined();
    const dto = recordDto(STATE.ACTIVATED);
    dto.product = { ...dto.product!, model: "RC-2" };
    expect(productViewOf({ kind: "record", dto }).model).toBe("RC-2");
  });

  it("shows a photo only from a host this app may show", () => {
    const dto = recordDto(STATE.ACTIVATED);
    dto.media = [{ role: "hero", url: "https://example.com/x.webp", mime: "image/webp" }];
    expect(productViewOf({ kind: "record", dto }).photo).toBeUndefined();

    dto.media = [];
    dto.image = "https://media.tagit.network/i/legacy/lg.webp";
    expect(productViewOf({ kind: "record", dto }).photo).toEqual({
      url: "https://media.tagit.network/i/legacy/lg.webp",
    });
  });

  it("never invents a fact the record does not carry", () => {
    const dto = recordDto(STATE.ACTIVATED);
    delete dto.product;
    delete dto.description;
    delete dto.timestamp;
    dto.media = [];
    dto.name = "  ";
    expect(productViewOf({ kind: "record", dto })).toEqual({
      name: COPY.product.fallbackName,
      named: false,
    });
  });
});

describe("hasProductToShow", () => {
  it("is true for a product with a name, a brand or a photo", () => {
    expect(hasProductToShow(productViewOf(record(STATE.ACTIVATED)))).toBe(true);
    expect(hasProductToShow({ name: COPY.product.fallbackName, named: false, brand: "B" })).toBe(
      true,
    );
    expect(
      hasProductToShow({
        name: COPY.product.fallbackName,
        named: false,
        photo: { url: "https://media.tagit.network/i/a/lg.webp" },
      }),
    ).toBe(true);
  });

  it("is false when only the neutral name is left", () => {
    expect(hasProductToShow(productViewOf(RESTRICTED))).toBe(false);
    expect(hasProductToShow(productViewOf({ kind: "unavailable" }))).toBe(false);
    expect(hasProductToShow(undefined)).toBe(false);
  });
});

describe("where an item stands, for its history", () => {
  it("after a tap: the state the tap just read", () => {
    expect(historyStatusOf("newForSale")).toBe("released");
    expect(historyStatusOf("newNotForSale")).toBe("released");
    expect(historyStatusOf("owned")).toBe("owned");
    expect(historyStatusOf("reported")).toBe("reported");
    expect(historyStatusOf("retired")).toBe("retired");
    // not released yet covers two steps, and the other states have no history
    for (const state of [
      "notReleased",
      "privateItem",
      "checkFailed",
      "linkUsed",
      "noProduct",
      "ourSide",
      "linkIncomplete",
    ] as const) {
      expect(historyStatusOf(state)).toBeUndefined();
    }
  });

  it("on the record page: only what cannot have been undone since the page was made", () => {
    expect(recordHistoryStatus(STATE.ACTIVATED)).toBe("released");
    expect(recordHistoryStatus(STATE.CLAIMED)).toBe("owned");
    expect(recordHistoryStatus(STATE.RECYCLED)).toBe("retired");
    // a report can be closed again, so it is left to the history itself
    expect(recordHistoryStatus(STATE.FLAGGED)).toBeUndefined();
    for (const code of [0, STATE.MINTED, STATE.BOUND, 9, undefined]) {
      expect(recordHistoryStatus(code)).toBeUndefined();
    }
  });
});

describe("recordFactsOf", () => {
  it("reads privacy and the listing from the record", () => {
    expect(recordFactsOf(record(STATE.ACTIVATED, true))).toEqual({
      restricted: false,
      listed: true,
    });
    expect(recordFactsOf(record(STATE.ACTIVATED))).toEqual({ restricted: false, listed: false });
    expect(recordFactsOf(RESTRICTED)).toEqual({ restricted: true, listed: false });
    for (const lookup of [{ kind: "none" } as const, { kind: "unavailable" } as const, null]) {
      expect(recordFactsOf(lookup)).toEqual({ restricted: false, listed: false });
    }
  });
});

describe("the product-details check", () => {
  it("reads the integrity tone in plain words", () => {
    expect(detailsCheckOf("green")).toBe("match");
    expect(detailsCheckOf("yellow")).toBe("pending");
    expect(detailsCheckOf("red")).toBe("mismatch");
    expect(detailsCheckLabel("match")).toBe(COPY.technical.detailsMatch);
    expect(detailsCheckLabel("pending")).toBe(COPY.technical.detailsPending);
    expect(detailsCheckLabel("mismatch")).toBe(COPY.technical.detailsMismatch);
  });
});
