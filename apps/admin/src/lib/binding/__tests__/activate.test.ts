import { describe, expect, it } from "vitest";

import { activatableTokenIds, describeOutcome, parseActivateOutcome, validatePriceInput } from "../activate";

describe("activate helpers", () => {
  it("picks bound/anchored tokens in numeric order", () => {
    const ids = activatableTokenIds([
      { tokenId: "58", lifecycle: "bound" },
      { tokenId: "7", lifecycle: "anchored" },
      { tokenId: "57", lifecycle: "recycled" },
      { tokenId: "59", lifecycle: "minted" },
    ]);
    expect(ids).toEqual(["7", "58"]);
  });

  it("parses the upstream body tolerantly and describes it", () => {
    const o = parseActivateOutcome({
      ok: true,
      txHash: "0xabc",
      activated: ["58"],
      alreadyActive: ["55", 56],
      skipped: [{ tokenId: "59", state: 1, reason: "not bound yet" }, { bogus: true }],
      listed: ["58"],
      alreadyListed: [],
      listErrors: [{ tokenId: "55", error: "sold" }],
    });
    expect(o.alreadyActive).toEqual(["55"]);
    expect(o.skipped).toHaveLength(1);
    expect(describeOutcome(o, "23.33")).toEqual([
      "1 activated (#58)",
      "1 already active",
      "1 listed at $23.33",
      "#59 skipped: not bound yet",
      "#55 not listed: sold",
    ]);
    expect(describeOutcome(parseActivateOutcome(null))).toEqual(["Failed."]);
    expect(describeOutcome(parseActivateOutcome({ ok: true }))).toEqual(["Nothing to do."]);
  });

  it("validates the price input", () => {
    expect(validatePriceInput("  ")).toEqual({ priceUsdc: null, error: null });
    expect(validatePriceInput("23.33")).toEqual({ priceUsdc: "23.33", error: null });
    expect(validatePriceInput("0")).toMatchObject({ priceUsdc: null });
    expect(validatePriceInput("1.1234567").error).toMatch(/6 decimals/);
    expect(validatePriceInput("$5").error).toMatch(/USDC/);
  });
});
