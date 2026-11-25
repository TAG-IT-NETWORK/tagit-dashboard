import { describe, expect, it } from "vitest";

import {
  activeProductCount,
  countWords,
  formatPrice,
  parseProducts,
  parseSummary,
  statusWords,
  tileNumber,
} from "@/lib/brand-catalog";

const row = (over: Record<string, unknown> = {}) => ({
  id: "tpl_1",
  name: "Day Cream",
  model: "Anti-Wrinkle",
  sku: "232501",
  category: "Cosmetics",
  status: "published",
  priceUsdc6: "29990000",
  businessId: "acme",
  itemsCount: 3,
  createdBy: "staff@tagit.test",
  description: "50 ml",
  ...over,
});
const answer = (templates: unknown) => ({ ok: true, count: 0, templates });

describe("formatPrice", () => {
  it("shows millionths of a dollar as dollars and cents", () => {
    expect(formatPrice("29990000")).toBe("$29.99");
    expect(formatPrice("23330000")).toBe("$23.33");
    expect(formatPrice("1000000")).toBe("$1.00");
    expect(formatPrice("50000")).toBe("$0.05");
    expect(formatPrice("1234567890000")).toBe("$1,234,567.89");
  });
  it("rounds to the nearest cent, half up", () => {
    expect(formatPrice("1004999")).toBe("$1.00");
    expect(formatPrice("1005000")).toBe("$1.01");
    expect(formatPrice("999999")).toBe("$1.00");
  });
  it("shows no price for zero and for anything that is not plain digits", () => {
    for (const bad of [
      "0",
      "000",
      "",
      "-5",
      "1.5",
      "1e6",
      " 5",
      "5 ",
      "0x10",
      "9".repeat(19),
      29990000,
      null,
      undefined,
      {},
      ["1"],
    ]) {
      expect(formatPrice(bad), JSON.stringify(bad)).toBeNull();
    }
  });
});

describe("parseProducts", () => {
  it("reads a brand's products and keeps only what the page shows", () => {
    const list = parseProducts(200, answer([row()]), "acme");
    expect(list).toEqual({
      loaded: true,
      products: [
        {
          id: "tpl_1",
          name: "Day Cream",
          model: "Anti-Wrinkle",
          sku: "232501",
          category: "Cosmetics",
          status: "published",
          price: "$29.99",
          items: 3,
        },
      ],
    });
    // Nothing else from the answer travels on: no staff email, no description.
    expect(JSON.stringify(list)).not.toContain("staff@tagit.test");
    expect(Object.keys(list.products[0]!)).toHaveLength(8);
  });

  it("drops every product that does not carry this brand's id", () => {
    const list = parseProducts(
      200,
      answer([
        row({ id: "a" }),
        row({ id: "b", businessId: "other" }),
        row({ id: "c", businessId: null }),
        row({ id: "d", businessId: undefined }),
        row({ id: "e", businessId: "ACME" }),
        row({ id: "f", businessId: "acme " }),
        row({ id: "g", businessId: ["acme"] }),
      ]),
      "acme",
    );
    expect(list.products.map((p) => p.id)).toEqual(["a"]);
  });

  it("drops rows it cannot show and fills gaps on the ones it can", () => {
    const list = parseProducts(
      200,
      answer([
        null,
        "x",
        7,
        row({ id: "" }),
        row({ id: "n", name: "   " }),
        row({ id: "s", status: "deleted" }),
        row({ id: "s2", status: undefined }),
        row({ id: "ok", model: "", sku: 5, category: null, priceUsdc6: null, itemsCount: -1 }),
        row({ id: "ok2", itemsCount: 2.5 }),
      ]),
      "acme",
    );
    expect(list.products.map((p) => p.id)).toEqual(["ok", "ok2"]);
    expect(list.products[0]).toMatchObject({
      model: null,
      sku: null,
      category: null,
      price: null,
      items: 0,
    });
    expect(list.products[1]!.items).toBe(0);
  });

  it("puts live products first, then drafts, then archived, each by name", () => {
    const list = parseProducts(
      200,
      answer([
        row({ id: "1", name: "Zeta", status: "archived" }),
        row({ id: "2", name: "Beta", status: "draft" }),
        row({ id: "3", name: "Mu", status: "published" }),
        row({ id: "4", name: "Alpha", status: "published" }),
      ]),
      "acme",
    );
    expect(list.products.map((p) => p.name)).toEqual(["Alpha", "Mu", "Beta", "Zeta"]);
  });

  it("trims long text and stops at 500 products", () => {
    const many = Array.from({ length: 600 }, (_, i) => row({ id: `t${i}`, name: "x".repeat(900) }));
    const list = parseProducts(200, answer(many), "acme");
    expect(list.products).toHaveLength(500);
    expect(list.products[0]!.name).toHaveLength(200);
  });

  it("says it could not load on any answer that is not a good list", () => {
    for (const [status, body] of [
      [0, null],
      [401, { ok: false }],
      [403, { ok: false, error: "BRAND_APP_ROUTE_FORBIDDEN" }],
      [500, answer([row()])],
      [200, null],
      [200, "nope"],
      [200, { ok: false, templates: [row()] }],
      [200, { ok: true }],
      [200, { ok: true, templates: { 0: row() } }],
    ] as Array<[number, unknown]>) {
      expect(parseProducts(status, body, "acme"), JSON.stringify(body)).toEqual({
        loaded: false,
        products: [],
      });
    }
  });

  it("tells an empty catalog apart from a failed load", () => {
    expect(parseProducts(200, answer([]), "acme")).toEqual({ loaded: true, products: [] });
  });
});

describe("parseSummary", () => {
  const summary = (over: Record<string, unknown> = {}) => ({
    ok: true,
    summary: {
      items: 10,
      byState: { MINTED: 2, BOUND: 1, ACTIVATED: 3, CLAIMED: 3, FLAGGED: 1, RECYCLED: 0 },
      notOnChain: 0,
      forSale: 2,
      ...over,
    },
  });

  it("reads the counts the tiles show", () => {
    expect(parseSummary(200, summary())).toEqual({
      items: 10,
      forSale: 2,
      withCustomers: 3,
      flagged: 1,
    });
  });

  it("reads all zeros for a brand with nothing", () => {
    expect(
      parseSummary(200, summary({ items: 0, forSale: 0, byState: { CLAIMED: 0, FLAGGED: 0 } })),
    ).toEqual({ items: 0, forSale: 0, withCustomers: 0, flagged: 0 });
  });

  it("refuses the whole answer when any number in it is not a count", () => {
    for (const over of [
      { items: -1 },
      { items: 1.5 },
      { items: "10" },
      { items: null },
      { items: Number.MAX_SAFE_INTEGER + 2 },
      { forSale: undefined },
      { forSale: Number.NaN },
      { byState: null },
      { byState: [] },
      { byState: { CLAIMED: 3 } },
      { byState: { FLAGGED: 1 } },
      { byState: { CLAIMED: "3", FLAGGED: 1 } },
    ]) {
      expect(parseSummary(200, summary(over)), JSON.stringify(over)).toBeNull();
    }
  });

  it("refuses counts where a part is bigger than the whole", () => {
    expect(parseSummary(200, summary({ forSale: 11 }))).toBeNull();
    expect(parseSummary(200, summary({ byState: { CLAIMED: 9, FLAGGED: 2 } }))).toBeNull();
  });

  it("refuses every answer that is not a good summary", () => {
    for (const [status, body] of [
      [0, null],
      [403, summary()],
      [500, summary()],
      [200, null],
      [200, { ok: false, summary: summary().summary }],
      [200, { ok: true }],
      [200, { ok: true, summary: "x" }],
    ] as Array<[number, unknown]>) {
      expect(parseSummary(status, body), JSON.stringify(body)).toBeNull();
    }
  });
});

describe("words and numbers", () => {
  it("counts the products a brand is running, not the archived ones", () => {
    const list = parseProducts(
      200,
      answer([
        row({ id: "1" }),
        row({ id: "2", status: "draft" }),
        row({ id: "3", status: "archived" }),
      ]),
      "acme",
    );
    expect(activeProductCount(list)).toBe(2);
    expect(activeProductCount({ loaded: false, products: [] })).toBeNull();
    expect(activeProductCount({ loaded: true, products: [] })).toBe(0);
  });

  it("shows a dash for a number that could not be read, never a zero", () => {
    expect(tileNumber(null)).toBe("–");
    expect(tileNumber(0)).toBe("0");
    expect(tileNumber(12045)).toBe("12,045");
  });

  it("names a status and counts in plain words", () => {
    expect(statusWords("published")).toBe("Live");
    expect(statusWords("draft")).toBe("Draft");
    expect(statusWords("archived")).toBe("Archived");
    expect(countWords(1, "item", "items")).toBe("1 item");
    expect(countWords(0, "item", "items")).toBe("0 items");
    expect(countWords(2500, "item", "items")).toBe("2,500 items");
  });
});
