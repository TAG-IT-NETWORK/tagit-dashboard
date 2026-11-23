import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BUY_RATE_LIMIT, parseBuyRequest } from "../buy-request";
import { demoOrderMessage } from "../demo-order";
import { takesDemoOrder, type CanonicalPrice } from "../price";

/**
 * TAP-T15: the buy route lends this server's keys to a settle only for a
 * request that brings its proof.
 */

const BUYER = "0x32be6C82A57d5bCe897538d7dA4109eA0eeB0aA1";
const PAY = `0x${"ab".repeat(32)}`;
const SIG = `0x${"1b".repeat(65)}`;

describe("parseBuyRequest", () => {
  it("takes a payment", () => {
    expect(
      parseBuyRequest({ tokenId: "58", buyerWallet: BUYER, paymentTxHash: PAY, priceUsdc: 23.33 }),
    ).toEqual({
      ok: true,
      value: { tokenId: "58", buyerWallet: BUYER, paymentTxHash: PAY, priceUsdc: 23.33 },
    });
  });

  it("takes a demo order", () => {
    const demoOrder = { expires: 1795000000, signature: SIG };
    expect(parseBuyRequest({ tokenId: "58", buyerWallet: BUYER, demoOrder })).toEqual({
      ok: true,
      value: { tokenId: "58", buyerWallet: BUYER, demoOrder },
    });
  });

  it("answers 402 to a request that brings neither", () => {
    for (const body of [
      { tokenId: "58", buyerWallet: BUYER },
      { tokenId: "58", buyerWallet: BUYER, paymentTxHash: undefined, demoOrder: null },
      { tokenId: "58", buyerWallet: BUYER, priceUsdc: 23.33 },
      { tokenId: "58", buyerWallet: BUYER, paid: true, proof: "trust me" },
    ]) {
      expect(parseBuyRequest(body)).toEqual({ ok: false, status: 402, code: "PAYMENT_REQUIRED" });
    }
  });

  it("answers 400 to a proof that is there but not shaped like one", () => {
    for (const extra of [
      { paymentTxHash: "0x1234" },
      { paymentTxHash: 7 },
      { paymentTxHash: "" },
      { demoOrder: { expires: 1795000000, signature: "0x12" } },
      { demoOrder: { expires: "soon", signature: SIG } },
      { demoOrder: { expires: -1, signature: SIG } },
      { demoOrder: { signature: SIG } },
      { demoOrder: "yes" },
      { demoOrder: [] },
    ]) {
      expect(parseBuyRequest({ tokenId: "58", buyerWallet: BUYER, ...extra })).toEqual({
        ok: false,
        status: 400,
        code: "INVALID_REQUEST",
      });
    }
  });

  it("answers 400 to a body that names no item or no wallet", () => {
    for (const body of [
      null,
      "x",
      [],
      {},
      { tokenId: 58, buyerWallet: BUYER, paymentTxHash: PAY },
      { tokenId: "58x", buyerWallet: BUYER, paymentTxHash: PAY },
      { tokenId: "58", buyerWallet: "0x123", paymentTxHash: PAY },
      { tokenId: "9".repeat(31), buyerWallet: BUYER, paymentTxHash: PAY },
    ]) {
      expect(parseBuyRequest(body)).toMatchObject({ ok: false, status: 400 });
    }
  });

  it("sends on only what it knows, and the payment alone when both proofs come", () => {
    const parsed = parseBuyRequest({
      tokenId: "58",
      buyerWallet: BUYER,
      paymentTxHash: PAY,
      demoOrder: { expires: 1795000000, signature: SIG },
      priceUsdc: -4,
      businessId: "someone-else",
      "x-relayer-key": "nope",
    });
    expect(parsed).toEqual({
      ok: true,
      value: { tokenId: "58", buyerWallet: BUYER, paymentTxHash: PAY, priceUsdc: undefined },
    });
    const order = parseBuyRequest({
      tokenId: "58",
      buyerWallet: BUYER,
      demoOrder: { expires: 1795000000, signature: SIG, extra: 1 },
    });
    expect(order).toEqual({
      ok: true,
      value: {
        tokenId: "58",
        buyerWallet: BUYER,
        demoOrder: { expires: 1795000000, signature: SIG },
      },
    });
  });
});

describe("demoOrderMessage", () => {
  it("is this exact text (tagit-services builds the same one to check the signature)", () => {
    expect(
      demoOrderMessage({
        tokenId: "058",
        buyer: "0x32be6c82a57d5bce897538d7da4109ea0eeb0aa1",
        chainId: 84532,
        expires: 1795000000,
      }),
    ).toBe(
      [
        "TAG IT demo order",
        "Item: 58",
        "Buyer: 0x32be6C82A57d5bCe897538d7dA4109eA0eeB0aA1",
        "Network: 84532",
        "Expires: 1795000000",
        "No payment is made. This registers the demo item to the buyer.",
      ].join("\n"),
    );
  });
});

describe("takesDemoOrder", () => {
  const price = (
    proof: unknown,
    saleState: CanonicalPrice["saleState"] = "listed",
  ): CanonicalPrice => ({
    tokenId: "58",
    priceUsdc6: "23330000",
    display: "$23.33",
    saleState,
    version: 1,
    purchase: { payTo: "0x1", token: "USDC", chainId: 84532, settleEndpoint: "/x", proof },
  });

  it("is true only for the server's exact word on a listed item", () => {
    expect(takesDemoOrder(price("demo-order"))).toBe(true);
    for (const proof of ["usdc", undefined, null, true, "DEMO-ORDER", "demo", "demo-order "]) {
      expect(takesDemoOrder(price(proof))).toBe(false);
    }
    expect(takesDemoOrder(price("demo-order", "sold"))).toBe(false);
    expect(takesDemoOrder(null)).toBe(false);
    expect(takesDemoOrder({ ...price("demo-order"), purchase: undefined })).toBe(false);
  });
});

describe("POST /api/buy", () => {
  const fetchMock = vi.fn();
  let ip = 0;
  const post = async (body: unknown, address = `10.0.0.${++ip}`) => {
    const { POST } = await import("@/app/api/buy/route");
    return POST(
      new Request("https://verify.example/api/buy", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": address },
        body: typeof body === "string" ? body : JSON.stringify(body),
      }),
    );
  };

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

  it("answers 402 to a request without proof and sends nothing upstream", async () => {
    const res = await post({ tokenId: "58", buyerWallet: BUYER });
    expect(res.status).toBe(402);
    expect(await res.json()).toEqual({ ok: false, code: "PAYMENT_REQUIRED" });
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 400 to a broken body and sends nothing upstream", async () => {
    expect((await post("{not json")).status).toBe(400);
    expect((await post({ tokenId: "58" })).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards a payment with both keys, and hands back the answer and its status", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, txHash: "0x01" }), { status: 200 }),
    );
    const res = await post({
      tokenId: "58",
      buyerWallet: BUYER,
      paymentTxHash: PAY,
      priceUsdc: 23.33,
      sneaky: 1,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, txHash: "0x01" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/v1\/sale\/settle$/);
    expect(init.headers).toMatchObject({
      authorization: "Bearer test-services-key",
      "x-relayer-key": "test-relayer-key",
    });
    expect(JSON.parse(init.body as string)).toEqual({
      tokenId: "58",
      buyerWallet: BUYER,
      paymentTxHash: PAY,
      priceUsdc: 23.33,
    });
  });

  it("forwards a demo order, and passes a refusal on with its status", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: false, code: "DEMO_ORDER_INVALID" }), { status: 403 }),
    );
    const demoOrder = { expires: 1795000000, signature: SIG };
    const res = await post({ tokenId: "58", buyerWallet: BUYER, demoOrder });
    expect(res.status).toBe(403);
    expect(
      JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string),
    ).toEqual({ tokenId: "58", buyerWallet: BUYER, demoOrder });
  });

  it("never repeats an upstream failure in its own words", async () => {
    fetchMock.mockRejectedValue(
      new Error("connect ECONNREFUSED internal-host.example:443 key=SECRET"),
    );
    const down = await post({ tokenId: "58", buyerWallet: BUYER, paymentTxHash: PAY });
    expect(down.status).toBe(502);
    expect(await down.json()).toEqual({ ok: false, code: "UPSTREAM_FAILED" });
    fetchMock.mockResolvedValue(new Response("<html>gateway SECRET</html>", { status: 502 }));
    const html = await post({ tokenId: "58", buyerWallet: BUYER, paymentTxHash: PAY });
    expect(await html.json()).toEqual({ ok: false, code: "UPSTREAM_FAILED" });
  });

  it("refuses to run without the services key, and says nothing about settings", async () => {
    vi.stubEnv("SERVICES_API_KEY", "");
    const res = await post({ tokenId: "58", buyerWallet: BUYER, paymentTxHash: PAY });
    expect(res.status).toBe(503);
    expect(JSON.stringify(await res.json())).not.toMatch(/SERVICES_API_KEY|configured on/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("limits one address, and only that address", async () => {
    fetchMock.mockImplementation(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const body = { tokenId: "58", buyerWallet: BUYER, paymentTxHash: PAY };
    for (let i = 0; i < BUY_RATE_LIMIT; i++)
      expect((await post(body, "203.0.113.9")).status).toBe(200);
    const over = await post(body, "203.0.113.9");
    expect(over.status).toBe(429);
    expect(await over.json()).toEqual({ ok: false, code: "TOO_MANY_REQUESTS" });
    expect(Number(over.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(BUY_RATE_LIMIT);
    expect((await post(body, "203.0.113.10")).status).toBe(200);
    // a refused request counts too: probing without proof uses up the same allowance
    for (let i = 0; i < BUY_RATE_LIMIT; i++)
      await post({ tokenId: "58", buyerWallet: BUYER }, "203.0.113.11");
    expect((await post(body, "203.0.113.11")).status).toBe(429);
  });
});
