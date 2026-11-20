import { describe, expect, it } from "vitest";

import {
  COPY,
  RECORD_STATES,
  SUPPORT_EMAIL,
  TAP_STATES,
  isFailureAfterPayment,
  purchaseFailure,
  supportMailto,
  type TapStateKey,
} from "../consumer-copy";

/**
 * TAP-T08: the approved words. This table is the "States and words" table of
 * PRD-TAP-001 §2.2, written out a second time on purpose: changing a state's
 * words means changing the PRD, then this table, then the copy file — not
 * just refreshing a snapshot.
 */
const APPROVED: Record<TapStateKey, [headline: string, line: string]> = {
  newForSale: ["Authentic", "Checked just now with the brand's record"],
  newNotForSale: ["Authentic", "Checked just now with the brand's record"],
  owned: ["Authentic", "This item has a registered owner"],
  notReleased: [
    "Not released for sale yet",
    "The tag is real, but the brand has not released this item",
  ],
  reported: ["Reported lost or stolen", "Please don't buy this item"],
  retired: ["Retired", "This item was recycled and its record is closed"],
  checkFailed: [
    "We couldn't verify this tag",
    "It didn't pass our check, so we can't confirm this product is authentic",
  ],
  linkUsed: [
    "This check has expired",
    "Each tap makes a one-time link, and this one was already used",
  ],
  noProduct: [
    "Tag not linked to a product",
    "This is a real TAG IT tag, but no product is registered to it yet",
  ],
  ourSide: [
    "We couldn't finish the check",
    "Something went wrong on our side. Your product may be fine",
  ],
  linkIncomplete: ["This link is incomplete", "Tap the tag again to get a fresh link"],
  privateItem: ["Authentic", "The owner keeps this item's details private"],
};

describe("the 12 tap states", () => {
  it("are exactly the approved twelve", () => {
    expect(Object.keys(TAP_STATES).sort()).toEqual(Object.keys(APPROVED).sort());
    expect(Object.keys(TAP_STATES)).toHaveLength(12);
  });

  it.each(Object.keys(APPROVED) as TapStateKey[])("%s says the approved words", (state) => {
    expect([TAP_STATES[state].headline, TAP_STATES[state].line]).toEqual(APPROVED[state]);
  });

  it("call only a passed check Authentic, and always in the reassuring tone", () => {
    for (const [state, copy] of Object.entries(TAP_STATES)) {
      expect(copy.headline === "Authentic", state).toBe(copy.tone === "ok");
    }
  });
});

describe("the record page", () => {
  it("never says Authentic: nobody tapped a tag to get there", () => {
    for (const copy of Object.values(RECORD_STATES)) {
      expect(`${copy.headline} ${copy.line}`).not.toMatch(/authentic/i);
      expect(copy.tone).not.toBe("ok");
    }
  });
});

/** Every string in the copy, with functions called on sample values. */
function strings(node: unknown, path: string, out: [string, string][] = []): [string, string][] {
  if (typeof node === "string") out.push([path, node]);
  else if (typeof node === "function") {
    // every copy function takes one value: a name, a place, a price or a count
    for (const sample of ["Sample", 2]) {
      try {
        strings((node as (v: unknown) => unknown)(sample), path, out);
      } catch {
        // a count-only function given a name: the other sample covers it
      }
    }
  } else if (Array.isArray(node)) node.forEach((v, i) => strings(v, `${path}[${i}]`, out));
  else if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) strings(value, `${path}.${key}`, out);
  }
  return out;
}

describe("one word per thing", () => {
  // Outside the Technical details drawer the shopper reads: tag, check, record,
  // owner, brand. The drawer (COPY.technical) may name the network.
  const { technical: _technical, ...shown } = COPY;
  // One thing does have "wallet" in its name: the third way to pay. The copy
  // deck (PRD-TAP-001 section 8) calls it "Crypto wallet: Pay with USDC", and
  // those three strings, exactly as written there, are the only exception.
  const PAY_METHOD_NAME = new Set(["crypto wallet", "Crypto wallet", "Pay with USDC"]);
  const everything = [
    ...strings(shown, "COPY"),
    ...strings(TAP_STATES, "TAP_STATES"),
    ...strings(RECORD_STATES, "RECORD_STATES"),
  ].filter(
    ([path, text]) =>
      !(/\.buy\.(methodNames|sheetRows)\.crypto\b/.test(path) && PAY_METHOD_NAME.has(text)),
  );

  it("lets the crypto wallet keep its name, in three places and nowhere else", () => {
    const named = strings(shown, "COPY").filter(([, text]) => /\bwallets?\b|\bUSDC\b/i.test(text));
    expect(named.map(([, text]) => text).sort()).toEqual([
      "Crypto wallet",
      "Pay with USDC",
      "crypto wallet",
    ]);
  });

  it("finds the copy", () => {
    expect(everything.length).toBeGreaterThan(120);
  });

  it.each<[string, RegExp]>([
    ["token", /\btokens?\b/i],
    ["NFC", /\bNFC\b/i],
    ["chip", /\bchips?\b/i],
    ["wallet", /\bwallets?\b/i],
    ["holder", /\bholders?\b/i],
    ["issuer", /\bissuers?\b/i],
    ["scan", /\bscan(s|ned|ning)?\b/i],
    ["blockchain", /\bblockchain\b/i],
    ["on-chain", /\bon-?chain\b/i],
    ["mint", /\bmint(s|ed|ing)?\b/i],
    ["twin", /\btwins?\b/i],
    ["counterfeit", /\bcounterfeits?\b/i],
    ["fake", /\bfakes?\b/i],
    ["USDC", /\bUSDC\b/i],
    ["Sepolia", /\bSepolia\b/i],
    ["a setting or a key", /\b(env|key|config|SDM|CMAC|PICC|RPC)\b/i],
    ["an address", /0x[0-9a-fA-F]{2,}/],
  ])("never says %s outside Technical details", (_word, pattern) => {
    const hits = everything.filter(([, text]) => pattern.test(text));
    expect(hits).toEqual([]);
  });

  it("has no empty and no untrimmed string", () => {
    for (const [path, text] of everything) {
      expect(text.trim(), path).toBe(text);
      expect(text.length, path).toBeGreaterThan(0);
    }
  });
});

describe("the honest-status sentence", () => {
  it("says pilot, test network and no completed audit", () => {
    expect(COPY.honestStatus).toMatch(/pilot/i);
    expect(COPY.honestStatus).toMatch(/test network/i);
    expect(COPY.honestStatus).toMatch(/not completed an external security audit/i);
  });
});

describe("when a purchase fails", () => {
  const NOT_CHARGED = /haven't been charged/i;

  it("says 'you haven't been charged' only if no payment was sent", () => {
    for (const kind of ["justSold", "failed"] as const) {
      expect(purchaseFailure(kind, false)).toMatch(NOT_CHARGED);
      expect(purchaseFailure(kind, true)).not.toMatch(NOT_CHARGED);
    }
    // failures that can only happen before or instead of a payment
    for (const message of [COPY.buy.paymentFailed, COPY.buy.noFunds]) {
      expect(message).toMatch(NOT_CHARGED);
    }
  });

  it("after a payment was sent: says so, asks not to pay again, and does not say 'try again'", () => {
    for (const kind of ["justSold", "failed"] as const) {
      const message = purchaseFailure(kind, true);
      expect(message).toMatch(/payment was sent/i);
      expect(message).toMatch(/don't pay again/i);
      expect(message).not.toMatch(/try again/i);
      expect(isFailureAfterPayment(message)).toBe(true);
      expect(isFailureAfterPayment(purchaseFailure(kind, false))).toBe(false);
    }
    expect(isFailureAfterPayment(null)).toBe(false);
    expect(isFailureAfterPayment(COPY.buy.noFunds)).toBe(false);
  });

  it("keeps the two kinds of failure apart", () => {
    expect(purchaseFailure("justSold", false)).toBe(COPY.buy.justSold);
    expect(purchaseFailure("failed", false)).toBe(COPY.buy.failed);
    expect(purchaseFailure("justSold", true)).not.toBe(purchaseFailure("failed", true));
  });
});

describe("supportMailto", () => {
  it("opens a message to support with a subject that says what it is about", () => {
    expect(supportMailto("Help with a product check (record 58)")).toBe(
      `mailto:${SUPPORT_EMAIL}?subject=Help%20with%20a%20product%20check%20(record%2058)`,
    );
  });

  it("cannot be turned into extra recipients or a body by the subject", () => {
    const href = supportMailto("x&cc=someone@example.com&body=hello");
    expect(href).not.toContain("&cc=");
    expect(href).not.toContain("&body=");
    expect(href.split("?")).toHaveLength(2);
  });
});

describe("the date a record carries", () => {
  // The registry stores the time of the item's LAST change (tag attached,
  // released, bought, reported, retired, handed on). It is not the day the
  // item was registered, and the page must not say so.
  it("is labelled as the last update, on the page and in Technical details", () => {
    expect(COPY.about.facts.updated).toBe("Last updated");
    expect(COPY.technical.updated).toBe("Last updated");
  });

  it("is nowhere labelled as a registration date", () => {
    const values: unknown[] = [
      ...Object.values(COPY.about.facts),
      ...Object.values(COPY.technical),
    ];
    const labels = values.filter((value): value is string => typeof value === "string");
    expect(labels.length).toBeGreaterThan(10);
    for (const label of labels) expect(label, label).not.toMatch(/^Registered( on)?$/i);
  });
});

describe("the same phone opening its check again (TAP-T10)", () => {
  // Decision D6: the same phone may open its link again for ten minutes, and
  // the result is then marked as an earlier check. These are the words that
  // mark it. They are NEW WORDS, not yet in the PRD's copy deck: change them
  // there first, then here.
  it("says how long ago, in the shopper's words, and how to get a fresh check", () => {
    expect(COPY.repeat.note(0)).toBe(
      "You checked this a moment ago. Tap the tag again for a fresh check.",
    );
    expect(COPY.repeat.note(1)).toBe(
      "You checked this 1 minute ago. Tap the tag again for a fresh check.",
    );
    expect(COPY.repeat.note(3)).toBe(
      "You checked this 3 minutes ago. Tap the tag again for a fresh check.",
    );
    expect(COPY.repeat.note(10)).toBe(
      "You checked this 10 minutes ago. Tap the tag again for a fresh check.",
    );
  });

  it("replaces the 'checked just now' line with one that does not say when", () => {
    expect(COPY.repeat.line).toBe("Checked with the brand's record");
    expect(TAP_STATES.newForSale.line).toBe(`Checked just now with the brand's record`);
  });

  it("never says 'just now', whatever the number of minutes", () => {
    for (let minutes = 0; minutes <= 15; minutes += 1) {
      expect(COPY.repeat.note(minutes)).not.toMatch(/just now/i);
    }
    expect(COPY.repeat.line).not.toMatch(/just now/i);
  });
});

/** TAP-T13: the words of the buy button and the payment sheet, as PRD-TAP-001 section 8 has them. */
describe("copy deck: buying", () => {
  it("matches the deck word for word", () => {
    expect(COPY.buy.button("$23.33")).toBe("Buy now · $23.33");
    expect(COPY.buy.sheetTitle).toBe("How would you like to pay?");
    expect(COPY.buy.sheetRows).toEqual({
      card: { title: "Card", line: "Visa, Mastercard, Amex or Apple Pay" },
      paypal: { title: "PayPal", line: "Pay with your PayPal account" },
      crypto: { title: "Crypto wallet", line: "Pay with USDC" },
    });
    expect(COPY.buy.sheetFooter).toBe(
      "Secure checkout. You become the registered owner as soon as your payment clears.",
    );
    expect(COPY.buy.demoNote).toBe("Demo checkout. No real money is charged.");
    expect(COPY.buy.paying).toBe("Confirming your payment…");
    expect(COPY.buy.registering).toBe("Registering you as the owner…");
    expect(`${COPY.buy.successTitle} ${COPY.buy.successBody("Renewal Cream")}`).toBe(
      "It's yours. Renewal Cream is now registered to you.",
    );
    expect(COPY.buy.paymentFailed).toBe(
      "Payment didn't go through. You haven't been charged. Try again or choose another way to pay.",
    );
    expect(COPY.buy.justSold).toBe(
      "Sorry, this item was just sold or taken off sale. You haven't been charged.",
    );
  });

  it("builds the line under the button from the deck's words", () => {
    const { payBy, or, methodNames } = COPY.buy;
    expect(`${payBy} ${methodNames.card}, ${methodNames.paypal} ${or} ${methodNames.crypto}`).toBe(
      "Pay by card, PayPal or crypto wallet",
    );
  });

  it("keeps the old crypto wording off the buy flow", () => {
    expect(JSON.stringify(COPY.buy)).not.toMatch(/gasless|sign in to buy|on base/i);
  });
});
