import { describe, expect, it } from "vitest";

import {
  PAY_METHOD_ORDER,
  READY_METHODS,
  SIGN_IN_METHODS,
  buyFlowReducer,
  isDemoCheckout,
  methodsLine,
  offeredMethods,
  type BuyFlow,
  type PayMethod,
} from "../buy-methods";
import { COPY } from "../consumer-copy";
import { priceDisplay, type CanonicalPrice } from "../price";

/**
 * TAP-T13: the ways to pay are the server's list, and only that. These pin
 * what the page makes of every shape that list can arrive in.
 */

function listed(purchase: Partial<NonNullable<CanonicalPrice["purchase"]>> = {}): CanonicalPrice {
  return {
    tokenId: "58",
    priceUsdc6: "23330000",
    display: "$23.33",
    saleState: "listed",
    version: 3,
    purchase: {
      payTo: "0x1111111111111111111111111111111111111111",
      token: "USDC",
      chainId: 84532,
      settleEndpoint: "/api/v1/sale/settle",
      ...purchase,
    },
  };
}

describe("offeredMethods", () => {
  it("offers what the server lists: three, one, none", () => {
    expect(offeredMethods(listed({ methods: ["card", "paypal", "crypto"] }))).toEqual([
      "card",
      "paypal",
      "crypto",
    ]);
    expect(offeredMethods(listed({ methods: ["card"] }))).toEqual(["card"]);
    expect(offeredMethods(listed({ methods: [] }))).toEqual([]);
  });

  it("keeps one fixed order and offers each way once, whatever the server sends", () => {
    expect(offeredMethods(listed({ methods: ["crypto", "card", "paypal", "card"] }))).toEqual([
      "card",
      "paypal",
      "crypto",
    ]);
    expect(offeredMethods(listed({ methods: ["paypal", "crypto"] }))).toEqual(["paypal", "crypto"]);
  });

  it("drops a way it does not know, and offers nothing when it knows none of them", () => {
    expect(offeredMethods(listed({ methods: ["card", "bank-transfer", 7, null] }))).toEqual([
      "card",
    ]);
    expect(offeredMethods(listed({ methods: ["bank-transfer"] }))).toEqual([]);
    expect(offeredMethods(listed({ methods: ["CARD", "Crypto"] }))).toEqual([]);
  });

  it("offers the crypto wallet alone when the server is from before the list", () => {
    expect(offeredMethods(listed())).toEqual(["crypto"]);
  });

  it("does not guess when the list is not a list", () => {
    for (const methods of ["card", { card: true }, null, 3, true]) {
      expect(offeredMethods(listed({ methods }))).toEqual([]);
    }
  });

  it("offers nothing when nothing is for sale", () => {
    expect(offeredMethods(null)).toEqual([]);
    expect(offeredMethods(undefined)).toEqual([]);
    const noBlock = { ...listed({ methods: ["card"] }), purchase: undefined };
    expect(offeredMethods(noBlock)).toEqual([]);
    for (const saleState of ["sold", "not_for_sale"] as const) {
      expect(offeredMethods({ ...listed({ methods: ["card", "crypto"] }), saleState })).toEqual([]);
    }
  });
});

describe("isDemoCheckout", () => {
  it("takes the server's word when it gives one", () => {
    expect(isDemoCheckout(listed({ demo: true, chainId: 8453 }))).toBe(true);
    expect(isDemoCheckout(listed({ demo: false, chainId: 84532 }))).toBe(false);
  });

  it("goes by the network when the server gives none: the test network is never real money", () => {
    expect(isDemoCheckout(listed({ chainId: 84532 }))).toBe(true);
    expect(isDemoCheckout(listed({ chainId: 8453 }))).toBe(false);
    expect(isDemoCheckout(listed({ demo: "yes", chainId: 8453 }))).toBe(false);
  });

  it("says nothing about a price with nothing to buy", () => {
    expect(isDemoCheckout(null)).toBe(false);
    expect(isDemoCheckout({ ...listed(), purchase: undefined })).toBe(false);
  });
});

describe("methodsLine", () => {
  it("is the copy deck's line for all three ways", () => {
    expect(methodsLine(["card", "paypal", "crypto"])).toBe("Pay by card, PayPal or crypto wallet");
  });

  it("names only the ways on offer", () => {
    expect(methodsLine(["card", "paypal"])).toBe("Pay by card or PayPal");
    expect(methodsLine(["paypal", "crypto"])).toBe("Pay by PayPal or crypto wallet");
    expect(methodsLine(["crypto"])).toBe("Pay by crypto wallet");
    expect(methodsLine(["card"])).toBe("Pay by card");
    expect(methodsLine([])).toBe("");
  });

  it("keeps the sheet's order whatever order it is given", () => {
    expect(methodsLine(["crypto", "card"])).toBe("Pay by card or crypto wallet");
  });
});

describe("buyFlowReducer", () => {
  const ALL: PayMethod[] = ["card", "paypal", "crypto"];
  const closed: BuyFlow = { step: "closed" };
  const sheet: BuyFlow = { step: "sheet" };

  it("opens the sheet only when there is a way to pay", () => {
    expect(buyFlowReducer(closed, { type: "open" }, ALL)).toEqual(sheet);
    expect(buyFlowReducer(closed, { type: "open" }, [])).toEqual(closed);
  });

  it("closes the sheet, and leaves a running way to pay alone", () => {
    expect(buyFlowReducer(sheet, { type: "close" }, ALL)).toEqual(closed);
    const running: BuyFlow = { step: "method", method: "crypto" };
    expect(buyFlowReducer(running, { type: "close" }, ALL)).toBe(running);
  });

  it("starts a way to pay that this build can take", () => {
    expect(READY_METHODS).toEqual(["card", "crypto"]);
    for (const method of ["card", "crypto"] as const) {
      expect(buyFlowReducer(sheet, { type: "choose", method }, ALL)).toEqual({
        step: "method",
        method,
      });
    }
  });

  it("stays on the sheet, with a plain note, for a way it cannot take yet", () => {
    expect(buyFlowReducer(sheet, { type: "choose", method: "paypal" }, ALL)).toEqual({
      step: "sheet",
      notice: COPY.buy.methodUnavailable,
    });
  });

  it("asks for a sign-in for every way it can take (the item goes to that account)", () => {
    expect(READY_METHODS.every((method) => SIGN_IN_METHODS.includes(method))).toBe(true);
    expect(SIGN_IN_METHODS).not.toContain("paypal");
  });

  it("ignores a choice that is not on offer, or made while the sheet is shut", () => {
    expect(buyFlowReducer(sheet, { type: "choose", method: "crypto" }, ["card"])).toBe(sheet);
    expect(buyFlowReducer(closed, { type: "choose", method: "crypto" }, ALL)).toBe(closed);
  });

  it("goes back to the sheet from a way to pay, with the note gone", () => {
    expect(
      buyFlowReducer({ step: "method", method: "crypto" }, { type: "chooseAnother" }, ALL),
    ).toEqual(sheet);
    expect(buyFlowReducer({ step: "sheet", notice: "x" }, { type: "open" }, ALL)).toEqual(sheet);
  });

  it("knows every way in the sheet's order", () => {
    expect(PAY_METHOD_ORDER).toEqual(["card", "paypal", "crypto"]);
  });
});

describe("priceDisplay", () => {
  it("is the server's own text when there is one", () => {
    expect(priceDisplay(listed())).toBe("$23.33");
  });

  it("writes the amount out from priceUsdc6 when the server sent no text", () => {
    expect(priceDisplay({ ...listed(), display: null })).toBe("$23.33");
    expect(priceDisplay({ ...listed(), display: null, priceUsdc6: "5000000" })).toBe("$5.00");
    expect(priceDisplay({ ...listed(), display: null, priceUsdc6: "990000" })).toBe("$0.99");
    expect(priceDisplay({ ...listed(), display: "", priceUsdc6: "1234560000" })).toBe("$1234.56");
  });

  it("is empty only when there is no amount at all", () => {
    expect(priceDisplay(null)).toBe("");
    expect(priceDisplay({ ...listed(), display: null, priceUsdc6: null })).toBe("");
    expect(priceDisplay({ ...listed(), display: null, priceUsdc6: "12.5" })).toBe("");
  });
});
