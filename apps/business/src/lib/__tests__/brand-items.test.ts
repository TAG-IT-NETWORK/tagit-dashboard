import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  dayWords,
  itemState,
  itemStateWords,
  ITEMS_PER_PAGE,
  parseCursor,
  parseItems,
  stateTally,
  type ItemState,
} from "@/lib/brand-items";
import { getBrandProductItems } from "@/lib/brand-services";
import { toBrandSession } from "@/lib/brand-session";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const row = (over: Record<string, unknown> = {}) => ({
  tokenId: "101",
  name: "Day Cream",
  templateId: "tpl_1",
  serial: "SN-001",
  lifecycle: "anchored",
  chainState: "ACTIVATED",
  bound: true,
  visibility: "public",
  saleState: "not_for_sale",
  priceUsdc6: "29990000",
  priceDisplay: "29.99 USDC",
  updatedAt: "2026-11-27T19:05:00.000Z",
  ...over,
});
const answer = (items: unknown, over: Record<string, unknown> = {}) => ({
  ok: true,
  templateId: "tpl_1",
  count: 0,
  items,
  nextCursor: null,
  ...over,
});

describe("parseCursor", () => {
  it("takes plain digits and nothing else", () => {
    expect(parseCursor("0")).toBe("0");
    expect(parseCursor("123456789012345678901234567890")).toBe("123456789012345678901234567890");
    for (const bad of [
      "",
      "-1",
      "1.5",
      "1e3",
      " 1",
      "1 ",
      "1&limit=100",
      "1%26x",
      "abc",
      "0x10",
      "1".repeat(31),
      7,
      null,
      undefined,
      ["1"],
    ]) {
      expect(parseCursor(bad), JSON.stringify(bad)).toBeNull();
    }
  });
});

describe("itemState", () => {
  it("names where an item is, in the brand's words", () => {
    const words = (chain: unknown, price: string | null = null) =>
      itemStateWords(itemState(chain, price));
    expect(words(null)).toBe("Being made");
    expect(words(undefined)).toBe("Being made");
    expect(words("MINTED")).toBe("Made, tag not attached yet");
    expect(words("BOUND")).toBe("Tag attached");
    expect(words("ACTIVATED")).toBe("Ready for sale");
    expect(words("ACTIVATED", "$29.99")).toBe("For sale");
    expect(words("CLAIMED")).toBe("With a customer");
    expect(words("FLAGGED")).toBe("Flagged");
    expect(words("RECYCLED")).toBe("Retired");
  });

  it("is for sale only when the item is ready AND has a price", () => {
    for (const chain of [null, "MINTED", "BOUND", "CLAIMED", "FLAGGED", "RECYCLED"]) {
      expect(itemState(chain, "$29.99"), String(chain)).not.toBe("for-sale");
    }
    expect(itemState("ACTIVATED", null)).toBe("ready");
  });

  it("does not guess at a state it does not know", () => {
    for (const odd of ["activated", "SOLD", "", 3, {}, "__proto__"]) {
      expect(itemState(odd, "$1.00"), JSON.stringify(odd)).toBe("unknown");
    }
    expect(itemStateWords("unknown")).toBe("Not known");
  });
});

describe("dayWords", () => {
  it("shows a time as a plain day, the same for every reader", () => {
    expect(dayWords("2026-11-27T19:05:00.000Z")).toBe("Nov 27, 2026");
    expect(dayWords("2026-01-01T00:00:00.000Z")).toBe("Jan 1, 2026");
    // Late in the day in UTC stays that day, wherever the server runs.
    expect(dayWords("2026-12-31T23:59:59.000Z")).toBe("Dec 31, 2026");
  });
  it("shows nothing for anything that is not a sensible time", () => {
    for (const bad of [
      "",
      "soon",
      "1999-01-01T00:00:00Z",
      "9999-01-01T00:00:00Z",
      "x".repeat(50),
      1795650364916,
      null,
      undefined,
      {},
    ]) {
      expect(dayWords(bad), JSON.stringify(bad)).toBeNull();
    }
  });
});

describe("parseItems", () => {
  it("reads the items and keeps only what the page shows", () => {
    const page = parseItems(200, answer([row()], { nextCursor: "101" }), "tpl_1");
    expect(page).toEqual({
      loaded: true,
      items: [
        {
          number: "101",
          serial: "SN-001",
          state: "for-sale",
          price: "$29.99",
          changed: "Nov 27, 2026",
        },
      ],
      next: "101",
    });
    expect(Object.keys(page.items[0]!)).toHaveLength(5);
  });

  it("shows nothing from an answer about another product", () => {
    for (const templateId of ["tpl_2", null, undefined, "TPL_1", "tpl_1 "]) {
      expect(parseItems(200, answer([row()], { templateId }), "tpl_1"), String(templateId)).toEqual(
        {
          loaded: false,
          items: [],
          next: null,
        },
      );
    }
  });

  it("drops a row filed under another product, or under none", () => {
    const page = parseItems(
      200,
      answer([
        row({ tokenId: "1" }),
        row({ tokenId: "2", templateId: "tpl_2" }),
        row({ tokenId: "3", templateId: null }),
        row({ tokenId: "4", templateId: undefined }),
        row({ tokenId: "5", templateId: "TPL_1" }),
      ]),
      "tpl_1",
    );
    expect(page.items.map((i) => i.number)).toEqual(["1"]);
  });

  it("drops rows it cannot show, and a number seen twice", () => {
    const page = parseItems(
      200,
      answer([
        null,
        "x",
        7,
        row({ tokenId: 101 }),
        row({ tokenId: "" }),
        row({ tokenId: "1a" }),
        row({ tokenId: "-4" }),
        row({ tokenId: "8" }),
        row({ tokenId: "8", serial: "again" }),
      ]),
      "tpl_1",
    );
    expect(page.items.map((i) => i.number)).toEqual(["8"]);
    expect(page.items[0]!.serial).toBe("SN-001");
  });

  it("shows a price only on an item that is for sale", () => {
    const page = parseItems(
      200,
      answer([
        row({ tokenId: "1", chainState: "ACTIVATED", priceUsdc6: "5000000" }),
        row({ tokenId: "2", chainState: "ACTIVATED", priceUsdc6: null }),
        row({ tokenId: "3", chainState: "MINTED", priceUsdc6: "5000000" }),
        row({ tokenId: "4", chainState: "CLAIMED", priceUsdc6: "5000000" }),
        row({ tokenId: "5", chainState: "ACTIVATED", priceUsdc6: "0" }),
        row({ tokenId: "6", chainState: "ACTIVATED", priceUsdc6: "abc" }),
      ]),
      "tpl_1",
    );
    expect(page.items.map((i) => [i.number, i.state, i.price])).toEqual([
      ["1", "for-sale", "$5.00"],
      ["2", "ready", null],
      ["3", "made", null],
      ["4", "with-customer", null],
      ["5", "ready", null],
      ["6", "ready", null],
    ]);
  });

  it("fills gaps: no serial, no date", () => {
    const [item] = parseItems(
      200,
      answer([row({ serial: "  ", updatedAt: "soon" })]),
      "tpl_1",
    ).items;
    expect(item).toMatchObject({ serial: null, changed: null });
    const [long] = parseItems(200, answer([row({ serial: "S".repeat(400) })]), "tpl_1").items;
    expect(long!.serial).toHaveLength(100);
  });

  it("stops at one page, and takes the next position only when it is plain digits", () => {
    const many = Array.from({ length: 120 }, (_, i) => row({ tokenId: String(i + 1) }));
    expect(parseItems(200, answer(many), "tpl_1").items).toHaveLength(ITEMS_PER_PAGE);
    expect(parseItems(200, answer([row()], { nextCursor: "50" }), "tpl_1").next).toBe("50");
    for (const bad of ["50&x=1", "abc", 50, {}, ""]) {
      expect(
        parseItems(200, answer([row()], { nextCursor: bad }), "tpl_1").next,
        JSON.stringify(bad),
      ).toBeNull();
    }
  });

  it("tells an empty list apart from a failed load", () => {
    expect(parseItems(200, answer([]), "tpl_1")).toEqual({ loaded: true, items: [], next: null });
    for (const [status, body] of [
      [0, null],
      [403, answer([row()])],
      [404, { ok: false, error: "NOT_FOUND" }],
      [500, answer([row()])],
      [200, null],
      [200, "x"],
      [200, { ok: false, templateId: "tpl_1", items: [row()] }],
      [200, { ok: true, templateId: "tpl_1" }],
      [200, { ok: true, templateId: "tpl_1", items: { 0: row() } }],
    ] as Array<[number, unknown]>) {
      expect(parseItems(status, body, "tpl_1"), JSON.stringify(body)).toEqual({
        loaded: false,
        items: [],
        next: null,
      });
    }
  });
});

describe("stateTally", () => {
  it("counts the items shown per state, in a fixed order, leaving zeros out", () => {
    const item = (state: ItemState) => ({
      number: "1",
      serial: null,
      state,
      price: null,
      changed: null,
    });
    expect(stateTally([item("made"), item("for-sale"), item("made"), item("flagged")])).toEqual([
      { state: "for-sale", count: 1 },
      { state: "made", count: 2 },
      { state: "flagged", count: 1 },
    ]);
    expect(stateTally([])).toEqual([]);
  });
});

describe("getBrandProductItems", () => {
  const session = toBrandSession({ email: "jane@acme.com", role: "viewer", businessId: "acme" })!;
  const fetchMock = vi.fn();
  const reply = (status: number, body: unknown) =>
    Promise.resolve(new Response(JSON.stringify(body), { status }));
  const last = () => fetchMock.mock.calls.at(-1) as [string, RequestInit];

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("SERVICES_API_KEY", "test-key");
    vi.stubEnv("SERVICES_URL", "https://services.test/");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("asks for one page of one product's items, under the session's brand, with GET", async () => {
    fetchMock.mockReturnValue(reply(200, answer([row()])));
    const page = await getBrandProductItems(session, "tpl_1", null);
    expect(page.items.map((i) => i.number)).toEqual(["101"]);
    const [url, init] = last();
    expect(url).toBe("https://services.test/api/v1/admin/templates/tpl_1/items?limit=50");
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
    expect((init.headers as Record<string, string>)["x-business-id"]).toBe("acme");
  });

  it("sends a page position only when it is plain digits", async () => {
    fetchMock.mockReturnValue(reply(200, answer([])));
    await getBrandProductItems(session, "tpl_1", "150");
    expect(last()[0]).toBe(
      "https://services.test/api/v1/admin/templates/tpl_1/items?limit=50&cursor=150",
    );
    for (const bad of ["150&limit=100", "1&chainState=CLAIMED", "abc", "-1", ""]) {
      await getBrandProductItems(session, "tpl_1", bad);
      expect(last()[0], bad).toBe(
        "https://services.test/api/v1/admin/templates/tpl_1/items?limit=50",
      );
    }
  });

  it("never asks about an id that is not a product id", async () => {
    for (const bad of ["../catalog", "tpl_1/items/../..", "tpl_1?x=1", "x", ""]) {
      expect(await getBrandProductItems(session, bad, null), bad).toEqual({
        loaded: false,
        items: [],
        next: null,
      });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says it could not load on a refusal or an outage, and never throws", async () => {
    fetchMock.mockReturnValueOnce(reply(404, { ok: false }));
    expect((await getBrandProductItems(session, "tpl_1", null)).loaded).toBe(false);
    fetchMock.mockRejectedValueOnce(new Error("network"));
    expect((await getBrandProductItems(session, "tpl_1", null)).loaded).toBe(false);
    vi.stubEnv("SERVICES_API_KEY", "");
    expect((await getBrandProductItems(session, "tpl_1", null)).loaded).toBe(false);
  });

  it("shows nothing from an answer about another product", async () => {
    fetchMock.mockReturnValue(reply(200, answer([row()], { templateId: "tpl_2" })));
    expect(await getBrandProductItems(session, "tpl_1", null)).toEqual({
      loaded: false,
      items: [],
      next: null,
    });
  });
});
