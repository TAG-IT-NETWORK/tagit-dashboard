import { describe, expect, it } from "vitest";

import {
  activatableTokenIds,
  awaitingActivation,
  describeOutcome,
  parseActivateOutcome,
  showActivatePanel,
  validatePriceInput,
} from "../activate";

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

describe("awaitingActivation: what the station's offer counts (TAP-T19)", () => {
  it("counts bound items that are not yet activated on the registry", () => {
    expect(
      awaitingActivation([
        { lifecycle: "bound", chainState: "BOUND" },
        { lifecycle: "anchored", chainState: "BOUND" },
        { lifecycle: "bound", chainState: "ACTIVATED" }, // already on sale
        { lifecycle: "anchored", chainState: "CLAIMED" }, // sold
        { lifecycle: "bound", chainState: "FLAGGED" },
        { lifecycle: "bound", chainState: "RECYCLED" },
        { lifecycle: "minted", chainState: null }, // still waits for a tag
        { lifecycle: "recycled", chainState: "RECYCLED" },
      ]),
    ).toBe(2);
  });

  it("counts a bound item whose registry state is unknown: better one offer too many", () => {
    expect(
      awaitingActivation([
        { lifecycle: "bound", chainState: null },
        { lifecycle: "bound" }, // an API that does not send the state
        { lifecycle: "bound", chainState: "SOMETHING_NEW" },
      ]),
    ).toBe(3);
  });

  it("is not what the panel sends: every bound item still goes to the API", () => {
    // Pressing the button again is how an item activated without a price is
    // listed later, so already-activated items stay in the request.
    const tokens = [
      { tokenId: "1", lifecycle: "bound", chainState: "ACTIVATED" },
      { tokenId: "2", lifecycle: "bound", chainState: "BOUND" },
    ];
    expect(awaitingActivation(tokens)).toBe(1);
    expect(activatableTokenIds(tokens)).toEqual(["1", "2"]);
  });
});

describe("showActivatePanel: Activate & list for the bound part of a batch (TAP-T19)", () => {
  const base = { loading: false, pending: 0, activatable: 0, shownBefore: false };

  it("shows as soon as one token is bound, while others still wait for a tag", () => {
    expect(showActivatePanel({ ...base, pending: 3, activatable: 2 })).toBe(true);
    expect(showActivatePanel({ ...base, pending: 9, activatable: 1 })).toBe(true);
  });

  it("does not show while nothing is bound yet", () => {
    expect(showActivatePanel({ ...base, pending: 5, activatable: 0 })).toBe(false);
  });

  it("shows when nothing is left to bind, as it always did", () => {
    expect(showActivatePanel({ ...base, pending: 0, activatable: 5 })).toBe(true);
    // Everything already activated: the panel still shows (with nothing to do).
    expect(showActivatePanel({ ...base, pending: 0, activatable: 0 })).toBe(true);
  });

  it("stays once the operator has opened it, so its report does not vanish", () => {
    // The bound part was just activated: nothing left to activate, some left to bind.
    expect(showActivatePanel({ ...base, pending: 3, activatable: 0, shownBefore: true })).toBe(
      true,
    );
  });

  it("never shows while the batch is still loading", () => {
    expect(
      showActivatePanel({ loading: true, pending: 0, activatable: 5, shownBefore: true }),
    ).toBe(false);
  });
});
