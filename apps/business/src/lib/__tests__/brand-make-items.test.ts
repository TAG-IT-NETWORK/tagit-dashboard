import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  bodyForRun,
  canMakeItems,
  parseCreatedRun,
  parseQuantity,
  parseRun,
  parseRunId,
  parseStart,
  startProblem,
} from "@/lib/brand-make-items";
import { createBrandRun, getBrandRun, startBrandRun } from "@/lib/brand-services";
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
    expect(read({})).toEqual({ id: RUN, size: 25, state: "waiting", made: 0 });
    expect(read({ state: "minting" }, { expected: 25, minted: 10 })).toEqual({
      id: RUN,
      size: 25,
      state: "making",
      made: 10,
    });
    expect(read({ state: "minted" }, { minted: 25 })).toEqual({
      id: RUN,
      size: 25,
      state: "made",
      made: 25,
    });
    expect(read({ state: "mint_failed" })?.state).toBe("failed");
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
