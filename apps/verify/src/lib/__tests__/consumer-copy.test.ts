import { describe, expect, it } from "vitest";

import {
  COPY,
  RECORD_STATES,
  SUPPORT_EMAIL,
  TAP_STATES,
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
  const everything = [
    ...strings(shown, "COPY"),
    ...strings(TAP_STATES, "TAP_STATES"),
    ...strings(RECORD_STATES, "RECORD_STATES"),
  ];

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
