import { describe, expect, it } from "vitest";

import { formatIsoDay, productFactsViewOf } from "../product-facts";
import type { AssetFactsBlock } from "../services";

/**
 * TAP-T09: from the item record's `facts` block to what a shopper is shown.
 * Invisible characters are built from code points so none lives in this file.
 */

const FULL: AssetFactsBlock = {
  size: "50 ml",
  ingredients: "Aqua, Glycerin, Sodium DNA, Niacinamide, Panthenol",
  howToUse: "Apply a small amount to clean skin, morning and evening.",
  warnings: "For external use only. Avoid contact with eyes.",
  useWithinMonths: 12,
  lot: "L2406A",
  madeOn: "2026-06-01",
  bestBefore: "2028-06-01",
};

describe("formatIsoDay", () => {
  it("writes a declared day the way the rest of the page writes dates", () => {
    expect(formatIsoDay("2026-06-01")).toBe("Jun 1, 2026");
    expect(formatIsoDay("2028-02-29")).toBe("Feb 29, 2028");
    expect(formatIsoDay("2026-12-31")).toBe("Dec 31, 2026");
  });

  it("is the same day for every shopper: a date, not a moment", () => {
    // Formatted in UTC, so a reader west of Greenwich does not see May 31.
    expect(formatIsoDay("2026-06-01")).toBe("Jun 1, 2026");
    expect(formatIsoDay("2026-01-01")).toBe("Jan 1, 2026");
  });

  it("gives nothing for anything that is not a real day", () => {
    for (const bad of [
      "2026-02-30",
      "2026-13-01",
      "26-06-01",
      "06/01/2026",
      "2026-06-01T00:00:00Z",
      "",
      null,
      undefined,
      20260601,
    ]) {
      expect(formatIsoDay(bad), String(bad)).toBeUndefined();
    }
  });
});

describe("productFactsViewOf", () => {
  it("turns a full block into display values", () => {
    expect(productFactsViewOf(FULL)).toEqual({
      size: "50 ml",
      batch: "L2406A",
      madeOn: "Jun 1, 2026",
      bestBefore: "Jun 1, 2028",
      useWithin: "12 months of opening",
      howToUse: "Apply a small amount to clean skin, morning and evening.",
      warnings: "For external use only. Avoid contact with eyes.",
      ingredients: "Aqua, Glycerin, Sodium DNA, Niacinamide, Panthenol",
    });
  });

  it("says one month in the singular", () => {
    expect(productFactsViewOf({ useWithinMonths: 1 })).toEqual({ useWithin: "1 month of opening" });
    expect(productFactsViewOf({ useWithinMonths: 6 })).toEqual({
      useWithin: "6 months of opening",
    });
  });

  it("carries only what is filled in, and nothing at all for an empty block", () => {
    expect(productFactsViewOf({ size: "50 ml" })).toEqual({ size: "50 ml" });
    expect(productFactsViewOf({})).toBeUndefined();
    expect(productFactsViewOf(undefined)).toBeUndefined();
    expect(productFactsViewOf(null)).toBeUndefined();
    expect(productFactsViewOf({ size: "", warnings: "   " })).toBeUndefined();
  });

  it("leaves out a value of the wrong kind instead of drawing it", () => {
    const odd = {
      size: 50,
      ingredients: ["Aqua", "Glycerin"],
      howToUse: { step: 1 },
      warnings: null,
      useWithinMonths: "12",
      lot: true,
      madeOn: 20260601,
      bestBefore: "soon",
    } as unknown as AssetFactsBlock;
    expect(productFactsViewOf(odd)).toBeUndefined();
  });

  it("leaves out a value over its cap", () => {
    const long = productFactsViewOf({
      size: "x".repeat(61),
      ingredients: "x".repeat(4001),
      howToUse: "x".repeat(1501),
      warnings: "x".repeat(1501),
      lot: "x".repeat(201),
    });
    expect(long).toBeUndefined();
    // At the cap is fine.
    expect(productFactsViewOf({ size: "x".repeat(60) })).toEqual({ size: "x".repeat(60) });
    expect(productFactsViewOf({ ingredients: "x".repeat(4000) })?.ingredients).toHaveLength(4000);
  });

  it("leaves out a value that hides control or text-direction characters", () => {
    for (const code of [
      0x00, 0x0a, 0x1f, 0x7f, 0x85, 0x2028, 0x2029, 0x202a, 0x202e, 0x2066, 0x2069,
    ]) {
      const hidden = `Keep${String.fromCharCode(code)}away`;
      expect(productFactsViewOf({ warnings: hidden, size: "50 ml" }), code.toString(16)).toEqual({
        size: "50 ml",
      });
    }
  });

  it("accepts use-within only as a whole number of months from 1 to 120", () => {
    for (const bad of [0, 121, 1.5, -6, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(productFactsViewOf({ useWithinMonths: bad }), String(bad)).toBeUndefined();
    }
    expect(productFactsViewOf({ useWithinMonths: 120 })).toEqual({
      useWithin: "120 months of opening",
    });
  });

  it("leaves text as it is: markup stays text, to be shown as text", () => {
    const markup = "<img src=x onerror=alert(1)> [link](https://evil.example)";
    expect(productFactsViewOf({ howToUse: markup })).toEqual({ howToUse: markup });
  });
});
