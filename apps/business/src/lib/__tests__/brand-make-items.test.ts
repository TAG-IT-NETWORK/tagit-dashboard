import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  bodyForRun,
  canMakeItems,
  isCalendarDay,
  parseRunFacts,
  parseRuns,
  readRunFacts,
  runStateWords,
  takesRunFacts,
  factDayWords,
  parseCreatedRun,
  parseQuantity,
  parseRun,
  parseRunId,
  parseStart,
  startProblem,
} from "@/lib/brand-make-items";
import { dayWords } from "@/lib/brand-items";
import { createBrandRun, getBrandRun, getBrandRuns, startBrandRun } from "@/lib/brand-services";
import { toBrandSession } from "@/lib/brand-session";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

/** A brand makes items itself (TAP-T17). */

const TPL = "tpl_NIGHTCREAM1";
const RUN = "bat_RUN0001";

describe("who may make items", () => {
  it("a Manager, and nobody else", () => {
    expect(canMakeItems("admin")).toBe(true);
    expect(canMakeItems("operator")).toBe(false);
    expect(canMakeItems("viewer")).toBe(false);
    expect(canMakeItems(null)).toBe(false);
  });
});

describe("parseQuantity", () => {
  it("takes whole numbers from 1 to 100", () => {
    expect(parseQuantity("1")).toBe(1);
    expect(parseQuantity("25")).toBe(25);
    expect(parseQuantity("100")).toBe(100);
  });
  it("refuses everything else", () => {
    for (const bad of [
      "0",
      "101",
      "999",
      "1000",
      "-5",
      "+5",
      "5.0",
      "5.5",
      "1e2",
      "0x10",
      "05",
      " 5",
      "5 ",
      "",
      "five",
      "٥",
      5,
      null,
      undefined,
      ["5"],
      new Blob(["5"]),
    ]) {
      expect(parseQuantity(bad), String(bad)).toBeNull();
    }
  });
});

describe("parseRunId", () => {
  it("takes a run id as tagit-services makes them", () => {
    expect(parseRunId("bat_01ABCdef")).toBe("bat_01ABCdef");
  });
  it("refuses anything that could become another address", () => {
    for (const bad of [
      "bat_",
      "bat_a/b",
      "bat_a%2Fb",
      "bat_a-b",
      "bat_a.b",
      "bat_a?x=1",
      "BAT_1",
      "tpl_1",
      "../x",
      `bat_${"a".repeat(65)}`,
      "bat_1\n",
      "",
      null,
      7,
    ]) {
      expect(parseRunId(bad), String(bad)).toBeNull();
    }
  });
});

describe("bodyForRun", () => {
  it("holds the product and the number and nothing else", () => {
    expect(bodyForRun(TPL, 7)).toEqual({ templateId: TPL, quantity: 7 });
    expect(Object.keys(bodyForRun(TPL, 7))).toEqual(["templateId", "quantity"]);
  });
});

const batch = (over: Record<string, unknown> = {}) => ({
  id: RUN,
  templateId: TPL,
  size: 25,
  state: "validated",
  actor: "someone@else.test",
  txHash: "0xabc",
  ...over,
});

describe("parseCreatedRun", () => {
  it("takes the id of a run for this product, of this size, not started", () => {
    expect(parseCreatedRun(201, { ok: true, batch: batch() }, TPL, 25)).toBe(RUN);
  });
  it("refuses anything else", () => {
    const cases: Array<[number, unknown]> = [
      [200, { ok: true, batch: batch() }],
      [201, { ok: false, batch: batch() }],
      [201, { batch: batch() }],
      [201, { ok: true }],
      [201, { ok: true, batch: batch({ templateId: "tpl_OTHER" }) }],
      [201, { ok: true, batch: batch({ size: 100 }) }],
      [201, { ok: true, batch: batch({ size: "25" }) }],
      [201, { ok: true, batch: batch({ state: "minting" }) }],
      [201, { ok: true, batch: batch({ state: "minted" }) }],
      [201, { ok: true, batch: batch({ id: "bat_a/b" }) }],
      [201, { ok: true, batch: batch({ id: 5 }) }],
      [201, null],
      [201, "ok"],
      [403, { ok: true, batch: batch() }],
      [0, null],
    ];
    for (const [status, body] of cases) {
      expect(parseCreatedRun(status, body, TPL, 25), JSON.stringify(body)).toBeNull();
    }
  });
});

describe("parseRun", () => {
  const read = (b: Record<string, unknown>, progress?: unknown) =>
    parseRun(200, { ok: true, batch: batch(b), progress }, RUN, TPL);

  it("reads each state in plain terms, with nothing but id, size, state and count", () => {
    expect(read({})).toEqual({
      id: RUN,
      size: 25,
      state: "waiting",
      made: 0,
      facts: null,
      unconfirmed: false,
    });
    expect(read({ state: "minting" }, { expected: 25, minted: 10 })).toEqual({
      id: RUN,
      size: 25,
      state: "making",
      made: 10,
      facts: null,
      unconfirmed: false,
    });
    expect(read({ state: "minted" }, { minted: 25 })).toEqual({
      id: RUN,
      size: 25,
      state: "made",
      made: 25,
      facts: null,
      unconfirmed: false,
    });
    expect(read({ state: "mint_failed" })?.state).toBe("failed");
  });

  it("tells a run that was never confirmed from one that plainly failed", () => {
    const failed = (failure: unknown, state = "mint_failed") =>
      parseRun(200, { ok: true, batch: batch({ state }), failure }, RUN, TPL)?.unconfirmed;
    expect(failed({ code: "MINT_NOT_CONFIRMED", message: "server words" })).toBe(true);
    expect(failed({ code: "MINT_REVERTED" })).toBe(false);
    expect(failed(null)).toBe(false);
    expect(failed("MINT_NOT_CONFIRMED")).toBe(false);
    // Only a run that did not finish can be unconfirmed.
    expect(failed({ code: "MINT_NOT_CONFIRMED" }, "minted")).toBe(false);
    expect(failed({ code: "MINT_NOT_CONFIRMED" }, "minting")).toBe(false);
  });

  it("does not show a run of another product, or another run", () => {
    expect(read({ templateId: "tpl_OTHER" })).toBeNull();
    expect(read({ id: "bat_OTHER" })).toBeNull();
    expect(read({ templateId: undefined })).toBeNull();
  });

  it("refuses a state, a size or an answer it does not know", () => {
    expect(read({ state: "paused" })).toBeNull();
    expect(read({ state: 1 })).toBeNull();
    expect(read({ state: "constructor" })).toBeNull();
    expect(read({ size: 0 })).toBeNull();
    expect(read({ size: 101 })).toBeNull();
    expect(read({ size: 2.5 })).toBeNull();
    expect(read({ size: "25" })).toBeNull();
    expect(parseRun(404, { ok: true, batch: batch() }, RUN, TPL)).toBeNull();
    expect(parseRun(200, { ok: false, batch: batch() }, RUN, TPL)).toBeNull();
    expect(parseRun(200, null, RUN, TPL)).toBeNull();
    expect(parseRun(200, { ok: true, batch: "x" }, RUN, TPL)).toBeNull();
  });

  it("never counts more made than the run holds, and ignores an odd count", () => {
    expect(read({ state: "minting" }, { minted: 999 })?.made).toBe(0);
    expect(read({ state: "minting" }, { minted: -1 })?.made).toBe(0);
    expect(read({ state: "minting" }, { minted: "10" })?.made).toBe(0);
    expect(read({ state: "minting" }, "x")?.made).toBe(0);
    expect(read({ state: "minted" }, undefined)?.made).toBe(25);
  });
});

describe("parseStart", () => {
  it("is started only for this run, on 200 or 202", () => {
    expect(parseStart(202, { ok: true, batchId: RUN, status: "minting" }, RUN)).toEqual({
      kind: "started",
    });
    expect(parseStart(200, { ok: true, batchId: RUN, status: "minted" }, RUN)).toEqual({
      kind: "started",
    });
    expect(parseStart(202, { ok: true, batchId: "bat_OTHER" }, RUN)).toEqual({ kind: "failed" });
    expect(parseStart(202, { ok: false, batchId: RUN }, RUN)).toEqual({ kind: "failed" });
    expect(parseStart(201, { ok: true, batchId: RUN }, RUN)).toEqual({ kind: "failed" });
  });

  it("reads the daily limit with its numbers", () => {
    const body = {
      ok: false,
      error: "BRAND_DAILY_LIMIT",
      message: "server words that are not shown",
      details: { limit: 500, used: 480, remaining: 20, wanted: 25 },
    };
    expect(parseStart(409, body, RUN)).toEqual({ kind: "limit", limit: 500, remaining: 20 });
    // Numbers that make no sense: a plain failure, not a made-up sentence.
    for (const details of [
      { limit: "500", remaining: 20 },
      { limit: 500, remaining: -1 },
      { limit: 500 },
      null,
    ]) {
      expect(parseStart(409, { ...body, details }, RUN)).toEqual({ kind: "failed" });
    }
    expect(parseStart(200, body, RUN)).toEqual({ kind: "failed" });
  });

  it("reads the other refusals it knows, and calls the rest failed", () => {
    expect(parseStart(409, { error: "BRAND_MINT_WALLET_MISSING" }, RUN)).toEqual({
      kind: "no-wallet",
    });
    expect(parseStart(409, { error: "TEMPLATE_NOT_PUBLISHED" }, RUN)).toEqual({
      kind: "not-ready",
    });
    expect(parseStart(409, { error: "TEMPLATE_INCOMPLETE" }, RUN)).toEqual({ kind: "not-ready" });
    expect(parseStart(403, { error: "BRAND_MINT_OFF" }, RUN)).toEqual({ kind: "off" });
    for (const [status, body] of [
      [403, { error: "BRAND_APP_ROUTE_FORBIDDEN" }],
      [404, { error: "NOT_FOUND" }],
      [401, { error: "UNAUTHORIZED" }],
      [500, { error: "INTERNAL_ERROR", message: "https://node.example/secret" }],
      [502, null],
      [0, null],
      [202, "ok"],
    ] as Array<[number, unknown]>) {
      expect(parseStart(status, body, RUN), String(status)).toEqual({ kind: "failed" });
    }
  });
});

describe("startProblem", () => {
  it("says what happened, that nothing was made, and what to do, in plain words", () => {
    const sentences = [
      startProblem({ kind: "limit", limit: 500, remaining: 20 }, 25),
      startProblem({ kind: "limit", limit: 500, remaining: 1 }, 25),
      startProblem({ kind: "limit", limit: 500, remaining: 0 }, 25),
      startProblem({ kind: "no-wallet" }, 25),
      startProblem({ kind: "not-ready" }, 25),
      startProblem({ kind: "off" }, 25),
      startProblem({ kind: "failed" }, 25),
    ];
    for (const sentence of sentences) {
      expect(sentence).toContain("Nothing was made.");
      expect(sentence).not.toMatch(/mint|wallet|batch|chain|relayer|0x|BRAND_|TEMPLATE_/i);
    }
    expect(sentences[0]).toContain("20 more items");
    expect(sentences[0]).toContain("this run has 25");
    expect(sentences[1]).toContain("1 more item ");
    expect(sentences[2]).toContain("reached its limit of 500");
  });
});

// ── lot and dates ────────────────────────────────────────────────────────────

describe("lot and dates", () => {
  const form = (values: Record<string, unknown>) => parseRunFacts((field) => values[field]);

  it("are offered only for the cosmetics category", () => {
    expect(takesRunFacts("cosmetics")).toBe(true);
    expect(takesRunFacts("  Cosmetics ")).toBe(true);
    for (const other of ["Cosnetic", "skincare", "", "cosmetics/x", null, undefined, 5]) {
      expect(takesRunFacts(other), String(other)).toBe(false);
    }
  });

  it("all empty means none, and empty fields are left out", () => {
    expect(form({})).toEqual({ ok: true, facts: null });
    expect(form({ lot: "  ", madeOn: "", bestBefore: null })).toEqual({ ok: true, facts: null });
    expect(form({ lot: " L-2026/11 #4 " })).toEqual({ ok: true, facts: { lot: "L-2026/11 #4" } });
    expect(form({ lot: "A1", madeOn: "2026-11-01", bestBefore: "2028-11-01" })).toEqual({
      ok: true,
      facts: { lot: "A1", madeOn: "2026-11-01", bestBefore: "2028-11-01" },
    });
    // Same day is fine.
    expect(form({ madeOn: "2026-11-01", bestBefore: "2026-11-01" }).ok).toBe(true);
  });

  it("refuses a lot that is too long, spans lines or carries hidden characters", () => {
    const rtl = String.fromCodePoint(0x202e);
    const lineSep = String.fromCodePoint(0x2028);
    const isolate = String.fromCodePoint(0x2066);
    const del = String.fromCodePoint(0x7f);
    for (const lot of [
      "x".repeat(61),
      "a\nb",
      "a\tb",
      `a${rtl}b`,
      `a${lineSep}b`,
      `a${isolate}b`,
      `a${del}b`,
    ]) {
      const result = form({ lot });
      expect(result.ok, JSON.stringify(lot)).toBe(false);
    }
    expect(form({ lot: "x".repeat(60) }).ok).toBe(true);
    // Real lot codes carry punctuation; the page escapes whatever it shows.
    for (const lot of ["#A-12 (EU), rev.2", "L/2026;11", "Lot <3>", "批次 12"]) {
      expect(form({ lot }), lot).toEqual({ ok: true, facts: { lot } });
      expect(readRunFacts({ lot })).toEqual({ lot });
    }
  });

  it("writes every day it accepts in plain words, old years included", () => {
    expect(factDayWords("2019-12-01")).toBe("Dec 1, 2019");
    expect(factDayWords("2000-01-31")).toBe("Jan 31, 2000");
    expect(factDayWords("2100-12-31")).toBe("Dec 31, 2100");
    expect(factDayWords("2028-02-29")).toBe("Feb 29, 2028");
  });

  it("refuses dates that are not real, and a best-before earlier than made-on", () => {
    for (const day of [
      "2026-02-30",
      "2026-13-01",
      "1999-12-31",
      "2101-01-01",
      "26-11-01",
      "2026/11/01",
      "tomorrow",
      "2026-11-01T00:00",
    ]) {
      expect(isCalendarDay(day), day).toBe(false);
      expect(form({ madeOn: day }), day).toEqual({
        ok: false,
        errors: { madeOn: "Choose a real date." },
      });
      expect(form({ bestBefore: day }).ok, day).toBe(false);
    }
    expect(isCalendarDay("2028-02-29")).toBe(true);
    expect(form({ madeOn: "2026-11-02", bestBefore: "2026-11-01" })).toEqual({
      ok: false,
      errors: { bestBefore: "Best before cannot be earlier than the day it was made." },
    });
  });

  it("go into the body under facts, with only the three known keys", () => {
    expect(bodyForRun(TPL, 7, null)).toEqual({ templateId: TPL, quantity: 7 });
    const sneaky = { lot: "A1", bestBefore: "2028-01-01", to: "0x1", price: 1 } as never;
    expect(bodyForRun(TPL, 7, sneaky)).toEqual({
      templateId: TPL,
      quantity: 7,
      facts: { lot: "A1", bestBefore: "2028-01-01" },
    });
  });

  it("are read back from a run only when they still pass the same checks", () => {
    expect(readRunFacts({ lot: "A1", madeOn: "2026-11-01", bestBefore: "2028-11-01" })).toEqual({
      lot: "A1",
      madeOn: "2026-11-01",
      bestBefore: "2028-11-01",
    });
    expect(readRunFacts({ lot: "a\nb", madeOn: "soon", bestBefore: 5 })).toBeNull();
    expect(readRunFacts({ lot: " padded ", madeOn: "2026-11-01" })).toEqual({
      madeOn: "2026-11-01",
    });
    expect(readRunFacts(null)).toBeNull();
    expect(readRunFacts("x")).toBeNull();
    expect(
      parseRun(200, { ok: true, batch: batch({ facts: { lot: "A1" } }) }, RUN, TPL)?.facts,
    ).toEqual({
      lot: "A1",
    });
  });
});

// ── run history ──────────────────────────────────────────────────────────────

describe("parseRuns", () => {
  const row = (over: Record<string, unknown> = {}) => ({
    id: "bat_A1",
    templateId: TPL,
    state: "minted",
    quantity: 25,
    minted: 25,
    actor: "mia@acme.com",
    createdAt: "2026-11-27T10:00:00.000Z",
    ...over,
  });
  const read = (batches: unknown) => parseRuns(200, { ok: true, batches }, TPL, dayWords);

  it("reads each run in plain terms, in the order sent", () => {
    expect(read([row(), row({ id: "bat_A2", state: "validated", quantity: 3 })])).toEqual([
      { id: "bat_A1", size: 25, state: "made", day: "Nov 27, 2026", by: "mia@acme.com" },
      { id: "bat_A2", size: 3, state: "waiting", day: "Nov 27, 2026", by: "mia@acme.com" },
    ]);
    expect(runStateWords("waiting")).toBe("Not started");
    expect(runStateWords("made")).toBe("Made");
    expect(runStateWords("failed")).toBe("Not finished");
    expect(runStateWords("making")).toBe("Being made");
  });

  it("drops a run of another product, a repeated run and a row it cannot read", () => {
    expect(
      read([
        row({ templateId: "tpl_OTHER", id: "bat_X1" }),
        row(),
        row(),
        row({ id: "bat_a/b" }),
        row({ id: "bat_A3", state: "constructor" }),
        row({ id: "bat_A4", quantity: 0 }),
        row({ id: "bat_A5", quantity: 500 }),
        null,
        "x",
      ])?.map((r) => r.id),
    ).toEqual(["bat_A1"]);
  });

  it("shows who only when it looks like an email, and no date rather than a wrong one", () => {
    expect(read([row({ actor: "api-key", createdAt: "never" })])).toEqual([
      { id: "bat_A1", size: 25, state: "made", day: null, by: null },
    ]);
    expect(read([row({ actor: 5 })])?.[0]?.by).toBeNull();
  });

  it("says it could not load rather than 'no runs'", () => {
    expect(parseRuns(500, { ok: true, batches: [] }, TPL, dayWords)).toBeNull();
    expect(parseRuns(200, { ok: false, batches: [] }, TPL, dayWords)).toBeNull();
    expect(parseRuns(200, { ok: true }, TPL, dayWords)).toBeNull();
    expect(parseRuns(403, null, TPL, dayWords)).toBeNull();
    expect(read([])).toEqual([]);
  });

  it("shows at most 50", () => {
    const many = Array.from({ length: 80 }, (_, i) => row({ id: `bat_N${i}` }));
    expect(read(many)).toHaveLength(50);
  });
});

// ── the calls ────────────────────────────────────────────────────────────────

describe("the calls to tagit-services", () => {
  const manager = toBrandSession({ email: "mia@acme.com", role: "admin", businessId: "acme" })!;
  const fetchMock = vi.fn();
  const answer = (status: number, body: unknown) =>
    Promise.resolve(new Response(JSON.stringify(body), { status }));
  const sent = (call = 0) => {
    const [url, init] = fetchMock.mock.calls[call] as [string, RequestInit];
    return {
      url,
      method: init.method,
      headers: init.headers as Record<string, string>,
      body: init.body,
    };
  };

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

  it("set a run up with the product and the number only, under the session's brand and user", async () => {
    fetchMock.mockReturnValue(answer(201, { ok: true, batch: batch({ size: 7 }) }));
    expect(await createBrandRun(manager, TPL, 7)).toBe(RUN);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = sent();
    expect(call.url).toBe("https://services.test/api/v1/admin/batches");
    expect(call.method).toBe("POST");
    expect(JSON.parse(String(call.body))).toEqual({ templateId: TPL, quantity: 7 });
    expect(call.headers).toMatchObject({
      authorization: "Bearer test-key",
      "x-business-id": "acme",
      "x-actor": "mia@acme.com",
      "content-type": "application/json",
    });
    expect(Object.keys(call.headers).sort()).toEqual([
      "authorization",
      "content-type",
      "x-actor",
      "x-business-id",
    ]);
  });

  it("send a lot and dates under facts when given, and list a product's runs with GET", async () => {
    fetchMock.mockReturnValue(answer(201, { ok: true, batch: batch({ size: 7 }) }));
    await createBrandRun(manager, TPL, 7, { lot: "A1", madeOn: "2026-11-01" });
    expect(JSON.parse(String(sent().body))).toEqual({
      templateId: TPL,
      quantity: 7,
      facts: { lot: "A1", madeOn: "2026-11-01" },
    });

    fetchMock.mockReset();
    fetchMock.mockReturnValue(
      answer(200, {
        ok: true,
        batches: [
          {
            id: RUN,
            templateId: TPL,
            state: "minted",
            quantity: 7,
            actor: "mia@acme.com",
            createdAt: "2026-11-27T10:00:00Z",
          },
          { id: "bat_THEIRS", templateId: "tpl_OTHER", state: "minted", quantity: 9 },
        ],
      }),
    );
    expect(await getBrandRuns(manager, TPL)).toEqual([
      { id: RUN, size: 7, state: "made", day: "Nov 27, 2026", by: "mia@acme.com" },
    ]);
    expect(sent().url).toBe(
      `https://services.test/api/v1/admin/batches?templateId=${TPL}&limit=50`,
    );
    expect(sent().method).toBe("GET");
    expect(sent().headers["x-business-id"]).toBe("acme");

    fetchMock.mockReset();
    expect(await getBrandRuns(manager, "tpl_a/b")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockRejectedValue(new Error("down"));
    expect(await getBrandRuns(manager, TPL)).toBeNull();
  });

  it("never ask to set a run up for a bad product id or a bad number", async () => {
    for (const [product, quantity] of [
      ["tpl_a/b", 5],
      ["not-a-product", 5],
      [TPL, 0],
      [TPL, 101],
      [TPL, 2.5],
      [TPL, Number.NaN],
      [TPL, -1],
    ] as Array<[string, number]>) {
      expect(await createBrandRun(manager, product, quantity)).toBeNull();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("start a run with an EMPTY body: no recipient, no chain, nothing", async () => {
    fetchMock.mockReturnValue(answer(202, { ok: true, batchId: RUN, status: "minting" }));
    expect(await startBrandRun(manager, RUN)).toEqual({ kind: "started" });
    const call = sent();
    expect(call.url).toBe(`https://services.test/api/v1/admin/batches/${RUN}/execute`);
    expect(call.method).toBe("POST");
    expect(call.body).toBe("{}");
    expect(call.headers["x-business-id"]).toBe("acme");
    expect(call.headers["x-relayer-key"]).toBeUndefined();
  });

  it("read a run with GET, and show it only for the product asked about", async () => {
    fetchMock.mockReturnValue(answer(200, { ok: true, batch: batch(), progress: { minted: 0 } }));
    expect(await getBrandRun(manager, TPL, RUN)).toMatchObject({ id: RUN, state: "waiting" });
    expect(sent().url).toBe(`https://services.test/api/v1/admin/batches/${RUN}`);
    expect(sent().method).toBe("GET");
    expect(await getBrandRun(manager, "tpl_OTHER", RUN)).toBeNull();
  });

  it("never ask about a run id that is not one", async () => {
    for (const bad of ["bat_a/b", "../x", "", "tpl_1", "bat_1/execute"]) {
      expect(await getBrandRun(manager, TPL, bad)).toBeNull();
      expect(await startBrandRun(manager, bad)).toEqual({ kind: "failed" });
    }
    expect(await getBrandRun(manager, "bad", RUN)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("report an outage or a missing key as not done, and never throw", async () => {
    fetchMock.mockRejectedValue(new Error("down"));
    expect(await createBrandRun(manager, TPL, 5)).toBeNull();
    expect(await getBrandRun(manager, TPL, RUN)).toBeNull();
    expect(await startBrandRun(manager, RUN)).toEqual({ kind: "failed" });
    vi.stubEnv("SERVICES_API_KEY", "");
    expect(await createBrandRun(manager, TPL, 5)).toBeNull();
    expect(await startBrandRun(manager, RUN)).toEqual({ kind: "failed" });
  });
});
