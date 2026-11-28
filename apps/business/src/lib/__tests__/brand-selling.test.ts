import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  bulkWords,
  canSellItems,
  parseItemNumber,
  parseSaleAnswer,
  parseSaleIntent,
  parseSalePrice,
  saleBody,
  saleProblem,
} from "@/lib/brand-selling";
import { setBrandItemSale } from "@/lib/brand-services";
import { toBrandSession } from "@/lib/brand-session";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

/** A brand sells its own items (TAP-T17). */

describe("who may sell", () => {
  it("a Manager, and nobody else", () => {
    expect(canSellItems("admin")).toBe(true);
    expect(canSellItems("operator")).toBe(false);
    expect(canSellItems("viewer")).toBe(false);
    expect(canSellItems(null)).toBe(false);
  });
});

describe("parseSalePrice", () => {
  it("takes dollars with up to two decimals and writes them with two", () => {
    expect(parseSalePrice("49")).toBe("49.00");
    expect(parseSalePrice("49.5")).toBe("49.50");
    expect(parseSalePrice(" 49.50 ")).toBe("49.50");
    expect(parseSalePrice("0.01")).toBe("0.01");
    expect(parseSalePrice("0.1")).toBe("0.10");
    expect(parseSalePrice("1000000")).toBe("1000000.00");
    expect(parseSalePrice("999999.99")).toBe("999999.99");
  });
  it("refuses zero, too much, and anything that is not a plain amount", () => {
    for (const bad of [
      "0",
      "0.00",
      "0.0",
      "1000000.01",
      "1000001",
      "10000000",
      "49.505",
      "49.",
      ".5",
      "-5",
      "+5",
      "1,000",
      "$49",
      "49 USD",
      "1e3",
      "0x10",
      "049",
      "4 9",
      "",
      "free",
      "٤٩",
      49,
      null,
      undefined,
      ["49"],
    ]) {
      expect(parseSalePrice(bad), String(bad)).toBeNull();
    }
  });
});

describe("parseItemNumber and parseSaleIntent", () => {
  it("take digits only, and three intents only", () => {
    expect(parseItemNumber("0")).toBe("0");
    expect(parseItemNumber("1048")).toBe("1048");
    for (const bad of [
      "",
      "01",
      "-1",
      "1.5",
      "1e2",
      "0x1",
      "12/price",
      "../1",
      "1 ",
      "9".repeat(31),
      12,
      null,
    ]) {
      expect(parseItemNumber(bad), String(bad)).toBeNull();
    }
    expect(parseSaleIntent("list")).toBe("list");
    expect(parseSaleIntent("reprice")).toBe("reprice");
    expect(parseSaleIntent("delist")).toBe("delist");
    for (const bad of ["LIST", "relist", "sell", "", null, 1]) {
      expect(parseSaleIntent(bad), String(bad)).toBeNull();
    }
  });
});

describe("saleBody", () => {
  it("is an action and a price, and a take-off carries no price", () => {
    expect(saleBody("list", "49.50")).toEqual({ action: "LIST", priceUsdc: "49.50" });
    expect(saleBody("reprice", "39.00")).toEqual({ action: "UPDATE", priceUsdc: "39.00" });
    expect(saleBody("delist", null)).toEqual({ action: "DELIST" });
    expect(saleBody("delist", "49.50")).toEqual({ action: "DELIST" });
    expect(Object.keys(saleBody("list", "49.50")!)).toEqual(["action", "priceUsdc"]);
  });
  it("is nothing without a checked price", () => {
    for (const price of [null, "49", "49.5", "0.00", "abc", "1000000.01"]) {
      expect(saleBody("list", price), String(price)).toBeNull();
      expect(saleBody("reprice", price), String(price)).toBeNull();
    }
  });
});

describe("parseSaleAnswer", () => {
  const ok = (over: Record<string, unknown> = {}) => ({
    ok: true,
    tokenId: "1048",
    listingStatus: "listed",
    priceUsdc6: "49500000",
    ...over,
  });
  it("is done only for this item, in the state that was asked for", () => {
    expect(parseSaleAnswer(200, ok(), "1048", "list")).toEqual({ kind: "done" });
    expect(parseSaleAnswer(200, ok(), "1048", "reprice")).toEqual({ kind: "done" });
    expect(parseSaleAnswer(200, ok({ listingStatus: "delisted" }), "1048", "delist")).toEqual({
      kind: "done",
    });
    expect(parseSaleAnswer(200, ok(), "1048", "delist")).toEqual({ kind: "failed" });
    expect(parseSaleAnswer(200, ok({ listingStatus: "delisted" }), "1048", "list")).toEqual({
      kind: "failed",
    });
    expect(parseSaleAnswer(200, ok({ tokenId: "1049" }), "1048", "list")).toEqual({
      kind: "failed",
    });
    expect(parseSaleAnswer(200, ok({ tokenId: 1048 }), "1048", "list")).toEqual({ kind: "failed" });
    expect(parseSaleAnswer(200, ok({ ok: false }), "1048", "list")).toEqual({ kind: "failed" });
    expect(parseSaleAnswer(201, ok(), "1048", "list")).toEqual({ kind: "failed" });
  });
  it("reads the refusals it knows and calls the rest failed", () => {
    expect(parseSaleAnswer(409, { error: "ITEM_NOT_READY_FOR_SALE" }, "1", "list")).toEqual({
      kind: "not-ready",
    });
    expect(parseSaleAnswer(409, { error: "ITEM_NOT_HELD_BY_BRAND" }, "1", "list")).toEqual({
      kind: "not-ours",
    });
    expect(parseSaleAnswer(409, { error: "BRAND_TREASURY_MISSING" }, "1", "list")).toEqual({
      kind: "not-set-up",
    });
    expect(parseSaleAnswer(409, { error: "BRAND_MINT_WALLET_MISSING" }, "1", "list")).toEqual({
      kind: "not-set-up",
    });
    expect(parseSaleAnswer(404, { error: "NOT_FOUND" }, "1", "reprice")).toEqual({ kind: "gone" });
    for (const [status, body] of [
      [400, { error: "VALIDATION_ERROR" }],
      [403, { error: "BRAND_APP_ROUTE_FORBIDDEN" }],
      [409, { error: "SELLER_TREASURY_LOCKED" }],
      [422, { error: "OWNER_READ_FAILED" }],
      [500, { error: "x", message: "https://node.example/key" }],
      [200, null],
      [0, null],
      [404, "x"],
    ] as Array<[number, unknown]>) {
      expect(parseSaleAnswer(status, body, "1", "list"), String(status)).toEqual({
        kind: "failed",
      });
    }
  });
});

describe("the words", () => {
  it("say nothing was changed, in plain words", () => {
    for (const kind of ["not-ready", "not-ours", "not-set-up", "failed"] as const) {
      const words = saleProblem({ kind });
      expect(words).toContain("Nothing was changed.");
      expect(words).not.toMatch(/wallet|chain|mint|listing|treasury|0x|ITEM_|BRAND_/i);
    }
    expect(saleProblem({ kind: "gone" })).not.toMatch(/wallet|chain|listing|0x/i);
  });
  it("sum a bulk run up", () => {
    expect(bulkWords(12, 0)).toBe("12 items put on sale.");
    expect(bulkWords(1, 0)).toBe("1 item put on sale.");
    expect(bulkWords(0, 0)).toBe("There were no items ready for sale on that page.");
    expect(bulkWords(0, 3)).toContain("None could be put on sale");
    expect(bulkWords(10, 2)).toBe("10 items put on sale. 2 items could not be; try those again.");
  });
});

describe("the call to tagit-services", () => {
  const manager = toBrandSession({ email: "mia@acme.com", role: "admin", businessId: "acme" })!;
  const fetchMock = vi.fn();
  const answer = (status: number, body: unknown) =>
    Promise.resolve(new Response(JSON.stringify(body), { status }));
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

  it("sends an action and a price, under the session's brand and user, and never a wallet", async () => {
    fetchMock.mockReturnValue(answer(200, { ok: true, tokenId: "1048", listingStatus: "listed" }));
    expect(await setBrandItemSale(manager, "1048", "list", "49.50")).toEqual({ kind: "done" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://services.test/api/v1/assets/1048/price");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(String(init.body))).toEqual({ action: "LIST", priceUsdc: "49.50" });
    expect(init.headers).toMatchObject({ "x-business-id": "acme", "x-actor": "mia@acme.com" });
    expect(String(init.body)).not.toMatch(/treasury|0x/i);
  });

  it("sends a take-off with no price", async () => {
    fetchMock.mockReturnValue(answer(200, { ok: true, tokenId: "7", listingStatus: "delisted" }));
    expect(await setBrandItemSale(manager, "7", "delist", null)).toEqual({ kind: "done" });
    expect((fetchMock.mock.calls[0] as [string, RequestInit])[1].body).toBe('{"action":"DELIST"}');
  });

  it("never calls out for a bad item number or an unchecked price", async () => {
    for (const [item, intent, price] of [
      ["12/price", "list", "49.50"],
      ["../7", "delist", null],
      ["1e2", "list", "49.50"],
      ["7", "list", "49.5"],
      ["7", "list", null],
      ["7", "reprice", "0.00"],
    ] as Array<[string, "list" | "reprice" | "delist", string | null]>) {
      expect(await setBrandItemSale(manager, item, intent, price)).toEqual({ kind: "failed" });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports an outage as not done, and never throws", async () => {
    fetchMock.mockRejectedValue(new Error("down"));
    expect(await setBrandItemSale(manager, "7", "list", "49.50")).toEqual({ kind: "failed" });
  });
});
