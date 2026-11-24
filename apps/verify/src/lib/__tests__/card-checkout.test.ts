import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CHECKOUT_RATE_LIMIT,
  checkoutFailure,
  firstOrderView,
  isFinalOrderState,
  isOrderId,
  orderBlocksBuying,
  parseOrderAnswer,
  parseOrderReturn,
  safeCheckoutUrl,
  startCardCheckout,
  watchOrder,
  type AskOrder,
  type OrderAnswer,
  type OrderView,
  askOrderFromProxy,
} from "../card-checkout";
import { parseCheckoutRequest } from "../card-checkout-request";
import { COPY } from "../consumer-copy";
import type { CanonicalPrice } from "../price";

/**
 * TAP-T14, shopper side. The page asks for a card page and is told about an
 * order; it decides nothing about either. These tests hold it to that: only
 * known fields go upstream, the buyer is sent to one host only, and nothing
 * is said about a payment that the server did not say.
 */

const BUYER = "0x00000000000000000000000000000000000000b1";
const ORDER = "ord_01JD0000000000000000000000";
const STRIPE_URL = "https://checkout.stripe.com/c/pay/cs_test_a1B2c3";

describe("parseCheckoutRequest", () => {
  it("takes an item, a wallet and a name, and nothing else", () => {
    expect(
      parseCheckoutRequest({
        tokenId: "62",
        buyerWallet: BUYER,
        productName: "  Day Cream ",
        amountCents: 1,
        priceUsdc6: "1",
        successUrl: "https://evil.example",
      }),
    ).toEqual({ tokenId: "62", buyerWallet: BUYER, productName: "Day Cream" });
  });

  it("leaves the name out when there is none, and cuts a long one", () => {
    expect(parseCheckoutRequest({ tokenId: "62", buyerWallet: BUYER })).toEqual({
      tokenId: "62",
      buyerWallet: BUYER,
    });
    expect(parseCheckoutRequest({ tokenId: "62", buyerWallet: BUYER, productName: "   " })).toEqual(
      {
        tokenId: "62",
        buyerWallet: BUYER,
      },
    );
    const long = parseCheckoutRequest({
      tokenId: "62",
      buyerWallet: BUYER,
      productName: "x".repeat(500),
    });
    expect(long?.productName).toHaveLength(120);
  });

  it.each([
    null,
    [],
    "62",
    {},
    { tokenId: "62" },
    { buyerWallet: BUYER },
    { tokenId: 62, buyerWallet: BUYER },
    { tokenId: "0", buyerWallet: BUYER },
    { tokenId: "-1", buyerWallet: BUYER },
    { tokenId: "6 2", buyerWallet: BUYER },
    { tokenId: "1".repeat(19), buyerWallet: BUYER },
    { tokenId: "62", buyerWallet: "0x123" },
    { tokenId: "62", buyerWallet: `${BUYER}00` },
    { tokenId: "62", buyerWallet: BUYER.slice(2) },
  ])("refuses %j", (body) => {
    expect(parseCheckoutRequest(body)).toBeNull();
  });

  it("takes the longest id tagit-services takes (18 digits)", () => {
    expect(parseCheckoutRequest({ tokenId: "9".repeat(18), buyerWallet: BUYER })?.tokenId).toBe(
      "9".repeat(18),
    );
  });
});

describe("safeCheckoutUrl", () => {
  it("passes the provider's checkout page", () => {
    expect(safeCheckoutUrl(STRIPE_URL)).toBe(STRIPE_URL);
  });

  it.each([
    undefined,
    null,
    42,
    "",
    "not a url",
    "http://checkout.stripe.com/c/pay/x",
    "https://checkout.stripe.com.evil.example/c/pay/x",
    "https://evil.example/checkout.stripe.com",
    "https://evilcheckout.stripe.com/x",
    "https://stripe.com/x",
    "https://user:pass@checkout.stripe.com/x",
    "https://checkout.stripe.com@evil.example/x",
    "https://checkout.stripe.com:8443/x",
    "javascript:alert(1)//checkout.stripe.com",
    "//checkout.stripe.com/x",
    `https://checkout.stripe.com/${"a".repeat(2100)}`,
  ])("refuses %j", (value) => {
    expect(safeCheckoutUrl(value)).toBeNull();
  });
});

describe("checkoutFailure", () => {
  it("reduces upstream's code to three, and anything unknown to the vaguest", () => {
    expect(checkoutFailure("CARD_NOT_OFFERED")).toBe("NOT_OFFERED");
    expect(checkoutFailure("CARD_CHECKOUT_OFF")).toBe("NOT_OFFERED");
    expect(checkoutFailure("NOT_FOR_SALE")).toBe("NOT_FOR_SALE");
    for (const code of ["CHECKOUT_UNAVAILABLE", "INTERNAL", undefined, null, 5, "x at db.host"]) {
      expect(checkoutFailure(code)).toBe("UNAVAILABLE");
    }
  });
});

describe("order ids and return addresses", () => {
  it("knows an order id by its exact shape", () => {
    expect(isOrderId(ORDER)).toBe(true);
    for (const value of [
      "",
      "ord_",
      ORDER.toLowerCase(),
      `${ORDER}0`,
      ORDER.slice(0, -1),
      `x${ORDER}`,
      `${ORDER}/../x`,
      null,
      42,
    ]) {
      expect(isOrderId(value)).toBe(false);
    }
  });

  it("reads the order, and whether the buyer came back without paying", () => {
    expect(parseOrderReturn(`?order=${ORDER}`)).toEqual({ orderId: ORDER, cancelled: false });
    expect(parseOrderReturn(`?order=${ORDER}&cancelled=1`)).toEqual({
      orderId: ORDER,
      cancelled: true,
    });
    expect(parseOrderReturn(`?order=${ORDER}&cancelled=true`)?.cancelled).toBe(false);
    expect(parseOrderReturn(`?paid=1&order=${ORDER}`)?.orderId).toBe(ORDER);
  });

  it("reads nothing from an ordinary address or a made-up order", () => {
    for (const search of ["", "?", "?order=", "?order=123", "?cancelled=1", "?order=<script>"]) {
      expect(parseOrderReturn(search)).toBeNull();
    }
  });

  it("starts with what the address alone allows: nothing about a payment, cancelled or not", () => {
    expect(firstOrderView(null)).toEqual({ kind: "none" });
    expect(firstOrderView({ orderId: ORDER, cancelled: true })).toEqual({ kind: "asking" });
    expect(firstOrderView({ orderId: ORDER, cancelled: false })).toEqual({ kind: "asking" });
  });
});

describe("parseOrderAnswer", () => {
  const answer = { orderId: ORDER, tokenId: "62", state: "paid", onRegistry: false };

  it("keeps the four fields and drops the rest", () => {
    expect(parseOrderAnswer({ ...answer, buyerWallet: BUYER, amountCents: 2333 })).toEqual(answer);
  });

  it("reads onRegistry as true only for true", () => {
    expect(parseOrderAnswer({ ...answer, onRegistry: "yes" })?.onRegistry).toBe(false);
    expect(parseOrderAnswer({ ...answer, onRegistry: 1 })?.onRegistry).toBe(false);
    expect(parseOrderAnswer({ ...answer, onRegistry: true })?.onRegistry).toBe(true);
  });

  it.each([
    null,
    "paid",
    {},
    { ...answer, state: "fulfilled" },
    { ...answer, state: "PAID" },
    { ...answer, state: undefined },
    { ...answer, orderId: "ord_x" },
    { ...answer, tokenId: 62 },
    { ...answer, tokenId: "6x" },
  ])("does not guess at %j", (value) => {
    expect(parseOrderAnswer(value)).toBeNull();
  });

  it("knows which states end the asking", () => {
    expect(["waiting", "paid"].map((s) => isFinalOrderState(s as OrderAnswer["state"]))).toEqual([
      false,
      false,
    ]);
    expect(
      ["registered", "problem", "expired"].map((s) => isFinalOrderState(s as OrderAnswer["state"])),
    ).toEqual([true, true, true]);
  });
});

describe("startCardCheckout", () => {
  const price = (methods: unknown, saleState: CanonicalPrice["saleState"] = "listed") =>
    ({
      tokenId: "62",
      priceUsdc6: "23330000",
      display: "$23.33",
      saleState,
      version: 1,
      purchase: { payTo: "0x1", token: "USDC", chainId: 84532, settleEndpoint: "/x", methods },
    }) satisfies CanonicalPrice;

  const reply = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  function run(options: { fresh?: CanonicalPrice | null; answer?: Response | Error }) {
    const fetchImpl = vi.fn(async () => {
      const answer = options.answer ?? reply(200, { ok: true, orderId: ORDER, url: STRIPE_URL });
      if (answer instanceof Error) throw answer;
      return answer;
    });
    const refetchPrice = vi.fn(async () =>
      options.fresh === undefined ? price(["card", "crypto"]) : options.fresh,
    );
    const result = startCardCheckout({
      tokenId: "62",
      buyerWallet: BUYER,
      productName: "Day Cream",
      refetchPrice,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    return { result, fetchImpl, refetchPrice };
  }

  it("re-reads the price, asks for a page with no price in the request, and gives its address", async () => {
    const { result, fetchImpl, refetchPrice } = run({});
    expect(await result).toEqual({ ok: true, url: STRIPE_URL });
    expect(refetchPrice).toHaveBeenCalledTimes(1);
    const [path, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(path).toBe("/api/checkout");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      tokenId: "62",
      buyerWallet: BUYER,
      productName: "Day Cream",
    });
  });

  it("asks for nothing when the item was sold meanwhile", async () => {
    for (const fresh of [null, price(["card"], "sold"), price(["card"], "not_for_sale")]) {
      const { result, fetchImpl } = run({ fresh });
      expect(await result).toEqual({ ok: false, message: COPY.buy.justSold });
      expect(fetchImpl).not.toHaveBeenCalled();
    }
  });

  it("asks for nothing when card is no longer offered for the item", async () => {
    for (const methods of [["crypto"], [], undefined, "card"]) {
      const { result, fetchImpl } = run({ fresh: price(methods) });
      expect(await result).toEqual({ ok: false, message: COPY.buy.methodWithdrawn });
      expect(fetchImpl).not.toHaveBeenCalled();
    }
  });

  it("says what the server's refusal means, and asks for the price again when the listing is gone", async () => {
    expect(await run({ answer: reply(409, { ok: false, code: "NOT_FOR_SALE" }) }).result).toEqual({
      ok: false,
      message: COPY.buy.justSold,
      refetch: true,
    });
    expect(await run({ answer: reply(409, { ok: false, code: "NOT_OFFERED" }) }).result).toEqual({
      ok: false,
      message: COPY.buy.methodWithdrawn,
    });
    for (const answer of [
      reply(502, { ok: false, code: "UNAVAILABLE" }),
      reply(429, { ok: false, code: "TOO_MANY_REQUESTS" }),
      reply(500, "boom at db.internal:5432"),
      reply(200, { ok: false }),
      reply(200, { url: STRIPE_URL }),
      new Error("network down at 10.0.0.1"),
    ]) {
      expect(await run({ answer }).result).toEqual({
        ok: false,
        message: COPY.buy.card.unavailable,
      });
    }
  });

  it("goes nowhere when the address is not the provider's checkout", async () => {
    for (const url of ["https://evil.example/pay", "http://checkout.stripe.com/x", undefined, 7]) {
      const { result } = run({ answer: reply(200, { ok: true, orderId: ORDER, url }) });
      expect(await result).toEqual({ ok: false, message: COPY.buy.card.unavailable });
    }
  });

  it("never tells the buyer they were charged, or repeats an error's own words", async () => {
    const { result } = run({ answer: new Error("ECONNREFUSED api.internal") });
    const failed = await result;
    expect(failed.ok).toBe(false);
    if (!failed.ok) {
      expect(failed.message).toContain("You haven't been charged");
      expect(failed.message).not.toMatch(/ECONNREFUSED|internal/);
    }
  });
});

describe("watchOrder", () => {
  const order = (state: OrderAnswer["state"], extra: Partial<OrderAnswer> = {}): OrderAnswer => ({
    orderId: ORDER,
    tokenId: "62",
    state,
    onRegistry: false,
    ...extra,
  });

  /** Runs a watch with a hand-cranked clock: `tick()` fires the next scheduled question. */
  function watch(answers: Array<OrderAnswer | "missing" | null>, limit = 5, cancelled = false) {
    const views: OrderView[] = [];
    const pending: Array<() => void> = [];
    const cancelledHandles: unknown[] = [];
    let registered = 0;
    let i = 0;
    const ask: AskOrder = vi.fn(async () => answers[Math.min(i++, answers.length - 1)] ?? null);
    const stop = watchOrder({
      orderId: ORDER,
      tokenId: "62",
      cancelled,
      ask,
      show: (view) => views.push(view),
      onRegistered: () => (registered += 1),
      limit,
      intervalMs: 1,
      schedule: (run) => {
        pending.push(run);
        return pending.length;
      },
      cancel: (handle) => cancelledHandles.push(handle),
    });
    const settle = () => new Promise((resolve) => setImmediate(resolve));
    const tick = async () => {
      pending.shift()?.();
      await settle();
    };
    return {
      views,
      ask,
      stop,
      tick,
      settle,
      pending,
      cancelledHandles,
      registered: () => registered,
    };
  }

  it("shows the paid order, keeps asking, and stops when it is registered", async () => {
    const w = watch([
      order("waiting"),
      order("paid"),
      order("registered", { onRegistry: true }),
      order("registered"),
    ]);
    await w.settle();
    await w.tick();
    await w.tick();
    expect(w.views.map((v) => (v.kind === "order" ? v.order.state : v.kind))).toEqual([
      "waiting",
      "paid",
      "registered",
    ]);
    expect(w.pending).toHaveLength(0);
    expect(w.ask).toHaveBeenCalledTimes(3);
    expect(w.registered()).toBe(1);
  });

  it.each(["problem", "expired"] as const)("stops at %s without a refresh", async (state) => {
    const w = watch([order(state)]);
    await w.settle();
    expect(w.views).toEqual([{ kind: "order", order: order(state) }]);
    expect(w.pending).toHaveLength(0);
    expect(w.registered()).toBe(0);
  });

  it("shows nothing for an order that does not exist, and asks no more", async () => {
    const w = watch(["missing"]);
    await w.settle();
    expect(w.views).toEqual([{ kind: "none" }]);
    expect(w.pending).toHaveLength(0);
  });

  it("shows nothing for another item's order, whatever its state", async () => {
    const w = watch([order("registered", { tokenId: "63", onRegistry: true })]);
    await w.settle();
    expect(w.views).toEqual([{ kind: "none" }]);
    expect(w.registered()).toBe(0);
    expect(w.pending).toHaveLength(0);
  });

  it("says nothing new while there is no answer, then admits it does not know", async () => {
    const w = watch([null], 3);
    await w.settle();
    await w.tick();
    await w.tick();
    expect(w.ask).toHaveBeenCalledTimes(3);
    expect(w.views).toEqual([{ kind: "unknown" }]);
    expect(w.pending).toHaveLength(0);
  });

  it("says the payment is slow, not unknown, once the order was seen", async () => {
    const w = watch([order("waiting"), null, null], 3);
    await w.settle();
    await w.tick();
    await w.tick();
    expect(w.views.map((v) => v.kind)).toEqual(["order", "slow"]);
  });

  it("stops asking, and shows nothing more, when it is stopped", async () => {
    const w = watch([order("waiting")]);
    await w.settle();
    expect(w.pending).toHaveLength(1);
    w.stop();
    expect(w.cancelledHandles).toHaveLength(1);
    await w.tick();
    expect(w.views).toHaveLength(1);
  });

  it("believes 'cancelled' only for an order the server calls unpaid, and then stops", async () => {
    const w = watch([order("waiting")], 5, true);
    await w.settle();
    expect(w.views).toEqual([{ kind: "cancelled" }]);
    expect(w.pending).toHaveLength(0);
    expect(w.ask).toHaveBeenCalledTimes(1);
  });

  it.each(["paid", "registered", "problem"] as const)(
    "shows a %s order as it is, whatever the address says about cancelling",
    async (state) => {
      const w = watch([order(state)], 5, true);
      await w.settle();
      expect(w.views).toEqual([{ kind: "order", order: order(state) }]);
      expect(w.views.some((v) => v.kind === "cancelled")).toBe(false);
    },
  );

  it("says nothing about a cancelled checkout while the server has not answered", async () => {
    const w = watch([null], 2, true);
    await w.settle();
    expect(w.views).toEqual([]);
    await w.tick();
    expect(w.views).toEqual([{ kind: "unknown" }]);
  });

  it("shows nothing for a 'cancelled' order that does not exist or is another item's", async () => {
    const missing = watch(["missing"], 5, true);
    await missing.settle();
    expect(missing.views).toEqual([{ kind: "none" }]);
    const other = watch([order("waiting", { tokenId: "63" })], 5, true);
    await other.settle();
    expect(other.views).toEqual([{ kind: "none" }]);
  });

  it("drops an answer that arrives after it was stopped", async () => {
    const w = watch([order("registered", { onRegistry: true })]);
    w.stop();
    await w.settle();
    expect(w.views).toEqual([]);
    expect(w.registered()).toBe(0);
  });
});

describe("POST /api/checkout", () => {
  const fetchMock = vi.fn();
  let ip = 0;
  const post = async (body: unknown, address = `10.1.0.${++ip}`) => {
    const { POST } = await import("@/app/api/checkout/route");
    return POST(
      new Request("https://verify.example/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": address },
        body: typeof body === "string" ? body : JSON.stringify(body),
      }),
    );
  };
  const upstream = (status: number, body: unknown) =>
    fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }));
  const good = { tokenId: "62", buyerWallet: BUYER, productName: "Day Cream" };

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("SERVICES_API_KEY", "test-services-key");
    vi.stubEnv("RELAYER_API_KEY", "test-relayer-key");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("forwards the three fields with the services key, and answers the order and its page", async () => {
    upstream(201, {
      orderId: ORDER,
      url: STRIPE_URL,
      expiresAt: "2026-11-24T00:00:00.000Z",
      amountCents: 2333,
    });
    const res = await post({ ...good, amountCents: 1, successUrl: "https://evil.example" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, orderId: ORDER, url: STRIPE_URL });
    expect(res.headers.get("cache-control")).toBe("no-store");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.tagit.network/api/v1/checkout/sessions");
    expect(JSON.parse(String(init.body))).toEqual(good);
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer test-services-key");
    // The relayer key moves items. A request for a card page has no use for it.
    expect(JSON.stringify(headers)).not.toContain("test-relayer-key");
  });

  it("answers 400 to a broken body and sends nothing upstream", async () => {
    expect((await post("{not json")).status).toBe(400);
    expect((await post({ tokenId: "62" })).status).toBe(400);
    expect((await post({ tokenId: "0", buyerWallet: BUYER })).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 503 without the services key and sends nothing upstream", async () => {
    vi.stubEnv("SERVICES_API_KEY", "");
    const res = await post(good);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, code: "NOT_CONFIGURED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [503, "CARD_CHECKOUT_OFF", 409, "NOT_OFFERED"],
    [409, "CARD_NOT_OFFERED", 409, "NOT_OFFERED"],
    [409, "NOT_FOR_SALE", 409, "NOT_FOR_SALE"],
    [502, "CHECKOUT_UNAVAILABLE", 502, "UNAVAILABLE"],
    [500, "INTERNAL_ERROR", 502, "UNAVAILABLE"],
    [401, "UNAUTHORIZED", 503, "NOT_CONFIGURED"],
    [403, "FORBIDDEN", 503, "NOT_CONFIGURED"],
  ])("turns upstream %i %s into %i %s, with none of its text", async (status, error, to, code) => {
    upstream(status, { error, message: "secret detail at db.internal:5432" });
    const res = await post(good);
    expect(res.status).toBe(to);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ ok: false, code });
    expect(text).not.toContain("db.internal");
  });

  it("refuses an answer whose address is not the provider's checkout, or whose order id is not one", async () => {
    upstream(201, { orderId: ORDER, url: "https://evil.example/pay" });
    expect((await post(good)).status).toBe(502);
    upstream(201, { orderId: "nope", url: STRIPE_URL });
    expect((await post(good)).status).toBe(502);
    upstream(201, "not json at all");
    expect((await post(good)).status).toBe(502);
  });

  it("answers 502 with a code, never the error's words, when upstream cannot be reached", async () => {
    fetchMock.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.9:443"));
    const res = await post(good);
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain("ECONNREFUSED");
  });

  it("limits requests per address, and counts each address by itself", async () => {
    upstream(201, { orderId: ORDER, url: STRIPE_URL });
    const address = "10.9.9.9";
    for (let i = 0; i < CHECKOUT_RATE_LIMIT; i++) {
      upstream(201, { orderId: ORDER, url: STRIPE_URL });
      expect((await post(good, address)).status).toBe(200);
    }
    const limited = await post(good, address);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toMatch(/^\d+$/);
    upstream(201, { orderId: ORDER, url: STRIPE_URL });
    expect((await post(good, "10.9.9.10")).status).toBe(200);
  });
});

describe("GET /api/checkout/orders/:id", () => {
  const fetchMock = vi.fn();
  let ip = 0;
  const get = async (id: string, address = `10.2.0.${++ip}`) => {
    const { GET } = await import("@/app/api/checkout/orders/[id]/route");
    return GET(
      new Request(`https://verify.example/api/checkout/orders/${id}`, {
        headers: { "x-forwarded-for": address },
      }),
      { params: Promise.resolve({ id }) },
    );
  };
  const answer = { orderId: ORDER, tokenId: "62", state: "paid", onRegistry: false };

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("SERVICES_API_KEY", "test-services-key");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("answers the four fields and nothing else upstream said", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ...answer, buyerWallet: BUYER, amountCents: 2333 })),
    );
    const res = await get(ORDER);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, ...answer });
    expect(res.headers.get("cache-control")).toBe("no-store");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.tagit.network/api/v1/checkout/orders/${ORDER}`);
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer test-services-key");
  });

  it("refuses an id that is not an order id, and sends nothing upstream", async () => {
    for (const id of ["1", "ord_x", `${ORDER}%2F..`, "../sessions", ORDER.toLowerCase()]) {
      expect((await get(id)).status).toBe(400);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 404 for an order that does not exist", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "NOT_FOUND" }), { status: 404 }),
    );
    const res = await get(ORDER);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, code: "NOT_FOUND" });
  });

  it("answers 502 to an answer it cannot read, or one about another order", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ...answer, state: "fulfilled" })));
    expect((await get(ORDER)).status).toBe(502);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ...answer, orderId: "ord_01JD0000000000000000000001" })),
    );
    expect((await get(ORDER)).status).toBe(502);
    fetchMock.mockResolvedValue(new Response("boom at db.internal", { status: 500 }));
    const failed = await get(ORDER);
    expect(failed.status).toBe(502);
    expect(await failed.text()).not.toContain("db.internal");
    fetchMock.mockRejectedValue(new Error("ECONNRESET"));
    expect((await get(ORDER)).status).toBe(502);
  });

  it("does not pass on an order read from a failed answer", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ...answer, state: "registered" }), { status: 500 }),
    );
    const res = await get(ORDER);
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ ok: false, code: "UNAVAILABLE" });
  });

  it("answers 503 without the services key", async () => {
    vi.stubEnv("SERVICES_API_KEY", "");
    expect((await get(ORDER)).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("askOrderFromProxy", () => {
  const fetchMock = vi.fn();
  const answer = { orderId: ORDER, tokenId: "62", state: "paid", onRegistry: false };

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("asks this app's own route, never a cached copy", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, ...answer })));
    expect(await askOrderFromProxy(ORDER)).toEqual(answer);
    expect(fetchMock.mock.calls[0]).toEqual([
      `/api/checkout/orders/${ORDER}`,
      { cache: "no-store" },
    ]);
  });

  it("tells 'no such order' apart from 'no answer'", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 404 }));
    expect(await askOrderFromProxy(ORDER)).toBe("missing");
    for (const status of [429, 500, 502, 503]) {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ ok: true, ...answer }), { status }),
      );
      expect(await askOrderFromProxy(ORDER)).toBeNull();
    }
    fetchMock.mockResolvedValue(new Response("<html>"));
    expect(await askOrderFromProxy(ORDER)).toBeNull();
    fetchMock.mockRejectedValue(new Error("offline"));
    expect(await askOrderFromProxy(ORDER)).toBeNull();
  });
});

describe("orderBlocksBuying", () => {
  const view = (state: OrderAnswer["state"]): OrderView => ({
    kind: "order",
    order: { orderId: ORDER, tokenId: "62", state, onRegistry: false },
  });

  it("offers the item again only when the order is known to have taken no money", () => {
    expect(orderBlocksBuying({ kind: "none" })).toBe(false);
    expect(orderBlocksBuying({ kind: "cancelled" })).toBe(false);
    expect(orderBlocksBuying(view("expired"))).toBe(false);
  });

  it("keeps the item off the page while a payment may be on its way or was made", () => {
    for (const blocked of [
      { kind: "asking" },
      { kind: "slow" },
      { kind: "unknown" },
      view("waiting"),
      view("paid"),
      view("registered"),
      view("problem"),
    ] as OrderView[]) {
      expect(orderBlocksBuying(blocked), JSON.stringify(blocked)).toBe(true);
    }
  });
});
