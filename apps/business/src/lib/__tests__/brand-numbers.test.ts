import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { evaluateAccess, type AccessSession } from "@/lib/access";
import {
  canExportSales,
  countryWords,
  parseSaleTime,
  parseSales,
  parseSalesFile,
  parseTapNumbers,
  priceWords,
  saleMethodWords,
  saleStateWords,
  saleTimeWords,
  SALES_FILE_HEADER,
  SALES_FILE_MAX_BYTES,
} from "@/lib/brand-numbers";
import { getBrandSales, getBrandSalesFile, getBrandTaps } from "@/lib/brand-services";
import { toBrandSession } from "@/lib/brand-session";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const as = (role: string) => toBrandSession({ email: "jane@acme.com", role, businessId: "acme" })!;
const fetchMock = vi.fn();
const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));
const text = (status: number, body: string) => Promise.resolve(new Response(body, { status }));

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

const TAPS = {
  taps7: 3,
  taps30: 5,
  usedLinks7: 1,
  usedLinks30: 2,
  topItems: [{ tokenId: "63", name: "Day Cream", taps: 3 }],
  topCountries: [{ country: "DE", taps: 2 }],
  capped: false,
};
const SALE = {
  id: "u12",
  tokenId: "63",
  name: "Day Cream",
  price: "33.33",
  method: "crypto",
  state: "sold",
  at: "2026-11-27T08:09:10.000Z",
};

describe("who may download the sales file", () => {
  it("a Manager, and nobody else", () => {
    expect(canExportSales("admin")).toBe(true);
    for (const role of ["operator", "viewer", null] as const)
      expect(canExportSales(role)).toBe(false);
  });

  it("the gate lets everyone on the team read /sales and only a Manager reach the file", () => {
    const who = (role: "viewer" | "operator" | "admin"): AccessSession => ({
      authenticated: true,
      role,
      brand: "acme",
    });
    for (const role of ["viewer", "operator", "admin"] as const) {
      expect(evaluateAccess("/sales", who(role), "GET"), role).toBe("allow");
    }
    expect(evaluateAccess("/sales/export", who("admin"), "GET")).toBe("allow");
    for (const role of ["viewer", "operator"] as const) {
      expect(evaluateAccess("/sales/export", who(role), "GET"), role).not.toBe("allow");
      expect(evaluateAccess("/sales/export", who(role)), role).not.toBe("allow");
    }
    const nobody: AccessSession = { authenticated: false, role: null, brand: null };
    const staff: AccessSession = { authenticated: true, role: "admin", brand: null };
    for (const path of ["/sales", "/sales/export"]) {
      expect(evaluateAccess(path, nobody), path).toBe("signin");
      expect(evaluateAccess(path, staff), path).not.toBe("allow");
    }
    expect(evaluateAccess("/salesx", who("admin"))).not.toBe("allow");
  });
});

describe("parseTapNumbers", () => {
  it("reads the numbers, items and countries", () => {
    expect(parseTapNumbers(200, { ok: true, taps: TAPS })).toEqual({
      taps7: 3,
      taps30: 5,
      usedLinks7: 1,
      usedLinks30: 2,
      topItems: [{ item: "63", name: "Day Cream", taps: 3 }],
      topCountries: [{ country: "DE", taps: 2 }],
      capped: false,
    });
  });

  it.each([
    ["a refusal", 403, { ok: true, taps: TAPS }],
    ["not ok", 200, { ok: false, taps: TAPS }],
    ["no numbers", 200, { ok: true }],
    ["a negative count", 200, { ok: true, taps: { ...TAPS, taps7: -1 } }],
    ["a fraction", 200, { ok: true, taps: { ...TAPS, taps30: 1.5 } }],
    ["text for a count", 200, { ok: true, taps: { ...TAPS, usedLinks7: "1" } }],
    ["nothing", 200, null],
  ])("gives null for %s", (_name, status, body) => {
    expect(parseTapNumbers(status, body)).toBeNull();
  });

  it("drops rows it cannot trust and keeps at most five", () => {
    const parsed = parseTapNumbers(200, {
      ok: true,
      taps: {
        ...TAPS,
        capped: "yes",
        topItems: [
          { tokenId: "0", name: "x", taps: 1 },
          { tokenId: "1 OR 1=1", name: "x", taps: 1 },
          { tokenId: 7, name: "x", taps: 1 },
          { tokenId: "8", name: "x", taps: 0 },
          null,
          { tokenId: "9", name: "  Cream‮\u0000  ", taps: 4 },
          { tokenId: "10", name: 5, taps: 1 },
        ],
        topCountries: [
          { country: "de", taps: 1 },
          { country: "DEU", taps: 1 },
          { country: "<b>", taps: 1 },
          { country: "FR", taps: "3" },
        ],
      },
    })!;
    expect(parsed.topItems).toEqual([
      { item: "9", name: "Cream", taps: 4 },
      { item: "10", name: null, taps: 1 },
    ]);
    expect(parsed.topCountries).toEqual([]);
    expect(parsed.capped).toBe(false);

    const many = Array.from({ length: 9 }, (_, i) => ({ tokenId: `${i + 1}`, name: "A", taps: 1 }));
    expect(
      parseTapNumbers(200, { ok: true, taps: { ...TAPS, topItems: many } })!.topItems,
    ).toHaveLength(5);
  });

  it("names a country in words", () => {
    expect(countryWords("DE")).toBe("Germany");
    expect(countryWords("US")).toBe("United States");
    expect(countryWords("de")).toBe("Unknown");
    expect(countryWords("<script>")).toBe("Unknown");
  });
});

describe("parseSales", () => {
  it("reads a page and where the next one starts", () => {
    expect(parseSales(200, { ok: true, sales: [SALE], next: "2026-11-27T08:09:10.000Z" })).toEqual({
      sales: [
        {
          key: "u12",
          item: "63",
          name: "Day Cream",
          price: "33.33",
          method: "crypto",
          state: "sold",
          at: "2026-11-27T08:09:10.000Z",
        },
      ],
      next: "2026-11-27T08:09:10.000Z",
    });
  });

  it("shows nothing of a buyer even when an answer carries one", () => {
    const page = parseSales(200, {
      ok: true,
      sales: [{ ...SALE, buyerWallet: "0xCBD1", paymentTxHash: "0x9e9e", orderId: "ord_1" }],
      next: null,
    })!;
    expect(Object.keys(page.sales[0]!).sort()).toEqual([
      "at",
      "item",
      "key",
      "method",
      "name",
      "price",
      "state",
    ]);
    expect(JSON.stringify(page)).not.toMatch(/0xCBD1|0x9e9e|ord_1/);
  });

  it.each([
    ["a made-up state", { state: "constructor" }],
    ["a made-up method", { method: "toString" }],
    ["a price that is not money", { price: "33.333" }],
    ["a price with a formula", { price: "=1+1" }],
    ["an item that is not a number", { tokenId: "63; drop" }],
    ["a time with no zone", { at: "2026-11-27T08:09:10" }],
    ["a time that is no date", { at: "2026-13-45T99:99:99Z" }],
  ])("drops a row with %s", (_name, over) => {
    expect(parseSales(200, { ok: true, sales: [{ ...SALE, ...over }, SALE] })!.sales).toHaveLength(
      1,
    );
  });

  it("an odd id is replaced, an odd name removed, an odd next ignored", () => {
    const page = parseSales(200, {
      ok: true,
      sales: [{ ...SALE, id: "../../x", name: "\u0000" }],
      next: "javascript:alert(1)",
    })!;
    expect(page.sales[0]).toMatchObject({ key: "2026-11-27T08:09:10.000Z-63", name: null });
    expect(page.next).toBeNull();
  });

  it.each([
    [403, { ok: true, sales: [] }],
    [200, { ok: false, sales: [] }],
    [200, { ok: true, sales: "none" }],
    [200, null],
  ])("gives null for an answer that is not a page (%s)", (status, body) => {
    expect(parseSales(status, body)).toBeNull();
  });

  it("puts states, methods, prices and times into words", () => {
    expect(saleStateWords("problem")).toBe("Needs attention");
    expect(saleStateWords("refund_due")).toBe("Refund due");
    expect(saleMethodWords("card")).toBe("Card");
    expect(priceWords("1234567.50")).toBe("$1,234,567.50");
    expect(priceWords("5.00")).toBe("$5.00");
    expect(priceWords("=1")).toBe("");
    expect(saleTimeWords("2026-11-27T08:09:10.000Z")).toBe("Nov 27, 2026, 8:09 AM UTC");
    expect(saleTimeWords("soon")).toBe("Date not known");
    expect(parseSaleTime("2026-11-27T08:09:10+02:00")).toBe("2026-11-27T08:09:10+02:00");
    expect(parseSaleTime(5)).toBeNull();
  });
});

describe("the calls", () => {
  const sent = () => fetchMock.mock.calls as Array<[string, RequestInit]>;

  it("ask for the session's brand, with GET and no body", async () => {
    fetchMock.mockReturnValueOnce(json(200, { ok: true, taps: TAPS }));
    fetchMock.mockReturnValueOnce(json(200, { ok: true, sales: [SALE], next: null }));
    expect((await getBrandTaps(as("viewer")))?.taps30).toBe(5);
    expect((await getBrandSales(as("viewer")))?.sales).toHaveLength(1);
    expect(sent().map(([url]) => url)).toEqual([
      "https://services.test/api/v1/admin/insights/taps",
      "https://services.test/api/v1/admin/insights/sales?limit=50",
    ]);
    for (const [, init] of sent()) {
      expect(init.method).toBe("GET");
      expect(init.body).toBeUndefined();
      expect(init.headers).toMatchObject({ "x-business-id": "acme", "x-actor": "jane@acme.com" });
    }
  });

  it("an older page is asked for by a checked time only", async () => {
    fetchMock.mockImplementation(() => json(200, { ok: true, sales: [], next: null }));
    await getBrandSales(as("viewer"), "2026-11-27T08:09:10.000Z");
    expect(sent()[0]![0]).toBe(
      "https://services.test/api/v1/admin/insights/sales?limit=50&before=2026-11-27T08%3A09%3A10.000Z",
    );
    for (const bad of ["yesterday", "2026-11-27&businessId=other", ["a"], 5, ""]) {
      expect(await getBrandSales(as("viewer"), bad)).toBeNull();
    }
    expect(sent()).toHaveLength(1);
  });

  it("a failed read is null, never a throw", async () => {
    fetchMock.mockRejectedValue(new Error("down"));
    expect(await getBrandTaps(as("admin"))).toBeNull();
    expect(await getBrandSales(as("admin"))).toBeNull();
    expect(await getBrandSalesFile(as("admin"))).toBeNull();
  });

  it("the file is asked for only by a Manager", async () => {
    fetchMock.mockImplementation(() => text(200, `${SALES_FILE_HEADER}\n"a"`));
    expect(await getBrandSalesFile(as("viewer"))).toBeNull();
    expect(await getBrandSalesFile(as("operator"))).toBeNull();
    expect(sent()).toHaveLength(0);
    expect(await getBrandSalesFile(as("admin"))).toBe(`${SALES_FILE_HEADER}\n"a"`);
    expect(sent()[0]![0]).toBe("https://services.test/api/v1/admin/insights/sales/export.csv");
  });

  it("only the file the API writes is handed on", () => {
    expect(parseSalesFile(200, SALES_FILE_HEADER)).toBe(SALES_FILE_HEADER);
    expect(parseSalesFile(200, `${SALES_FILE_HEADER}\n"x"`)).not.toBeNull();
    for (const [status, body] of [
      [403, `${SALES_FILE_HEADER}\n`],
      [200, '{"ok":false,"error":"BRAND_SALES_EXPORT_MANAGERS_ONLY"}'],
      [200, "<html>Sign in</html>"],
      [200, `${SALES_FILE_HEADER}<script>`],
      [200, null],
      [200, `${SALES_FILE_HEADER}\n${"x".repeat(SALES_FILE_MAX_BYTES)}`],
    ] as Array<[number, unknown]>) {
      expect(parseSalesFile(status, body)).toBeNull();
    }
  });
});
