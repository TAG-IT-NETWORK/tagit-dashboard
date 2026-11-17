// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Unit tests for the mint-proxy route. Mocked fetch — no live services, no
 * chain. Core regression: services answering "submitted, still pending" must
 * come back to the form as 202 mint_pending, never as "mint failed (502)" —
 * that message is what invited a duplicate-minting retry.
 */

const actorRoleMock = vi.hoisted(() => ({
  role: "editor" as "admin" | "editor" | "viewer" | null,
}));
vi.mock("@/lib/actor-role", () => ({
  getActorRole: async () => actorRoleMock.role,
}));
vi.mock("@/lib/actor", () => ({
  getActor: async () => "ops@example.test",
  getTenant: async () => null,
  actorHeader: (a: string | null) => (a ? { "x-actor": a } : {}),
  tenantHeader: (t: string | null) => (t ? { "x-business-id": t } : {}),
}));

const OWNER = "0x458B4d0c3a55006965Fd13D6af7B8509De51Cb3D";

async function load() {
  vi.resetModules();
  return import("../mint-proxy/route");
}

function post(body: Record<string, unknown>): Request {
  return new Request("http://admin.local/api/mint-proxy", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  to: OWNER,
  docDraft: { name: "OIKOS PRO" },
  mintRequestId: "req-1",
  priceUsdc: "1.99",
};

function json(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("/api/mint-proxy", () => {
  const originalEnv = { ...process.env };
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    actorRoleMock.role = "editor";
    process.env.SERVICES_API_KEY = "test-key";
    process.env.RELAYER_API_KEY = "test-relayer";
    process.env.SERVICES_URL = "https://services.test";
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
  });

  it("mints synchronously (?wait=true) and lists the price", async () => {
    fetchMock
      .mockResolvedValueOnce(json(201, { ok: true, created: true, tokenId: "59", txHash: "0xabc" }))
      .mockResolvedValueOnce(json(200, { ok: true }));
    const { POST } = await load();
    const res = await POST(post(validBody));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toMatchObject({ ok: true, status: "minted", tokenId: "59", txHash: "0xabc" });
    expect(data.price).toEqual({ ok: true });

    const [mintUrl, mintInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(mintUrl).toBe("https://services.test/api/v1/assets/mint?wait=true");
    expect(JSON.parse(String(mintInit.body))).toEqual({
      to: OWNER,
      docDraft: { name: "OIKOS PRO" },
      mintRequestId: "req-1",
    });
    const [priceUrl, priceInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(priceUrl).toBe("https://services.test/api/v1/assets/59/price");
    expect(JSON.parse(String(priceInit.body))).toEqual({ action: "LIST", priceUsdc: "1.99" });
  });

  it("reports a still-pending replay as 202 mint_pending, not a failure", async () => {
    fetchMock.mockResolvedValueOnce(
      json(200, { ok: true, created: false, item: { status: "mint_pending", txHash: "0xdef" } }),
    );
    const { POST } = await load();
    const res = await POST(post(validBody));
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({
      ok: true,
      status: "mint_pending",
      mintRequestId: "req-1",
      txHash: "0xdef",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1); // no price call yet
  });

  it("reports the async 202 shape as pending", async () => {
    fetchMock.mockResolvedValueOnce(
      json(202, { ok: true, mintRequestId: "req-1", status: "mint_pending", txHash: "0x1" }),
    );
    const { POST } = await load();
    const res = await POST(post(validBody));
    expect(res.status).toBe(202);
    expect((await res.json()).status).toBe("mint_pending");
  });

  it("treats a submitted-but-unknown outcome (upstream 502, row pending) as pending", async () => {
    fetchMock.mockResolvedValueOnce(
      json(502, {
        ok: false,
        error: "timed out waiting for receipt",
        item: { status: "mint_pending", txHash: "0x2" },
      }),
    );
    const { POST } = await load();
    const res = await POST(post(validBody));
    expect(res.status).toBe(202);
    expect(await res.json()).toMatchObject({ status: "mint_pending", txHash: "0x2" });
  });

  it("treats its own wait timeout as pending", async () => {
    fetchMock.mockRejectedValueOnce(Object.assign(new Error("timeout"), { name: "TimeoutError" }));
    const { POST } = await load();
    const res = await POST(post(validBody));
    expect(res.status).toBe(202);
    expect((await res.json()).status).toBe("mint_pending");
  });

  it("surfaces a real failure with its status so the form can offer a safe retry", async () => {
    fetchMock.mockResolvedValueOnce(
      json(502, { ok: false, error: "mint tx reverted", item: { status: "mint_failed" } }),
    );
    const { POST } = await load();
    const res = await POST(post(validBody));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      ok: false,
      error: "mint tx reverted",
      status: "mint_failed",
    });
  });

  it("rejects viewers before calling services", async () => {
    actorRoleMock.role = "viewer";
    const { POST, GET } = await load();
    expect((await POST(post(validBody))).status).toBe(403);
    expect(
      (await GET(new Request("http://admin.local/api/mint-proxy?mintRequestId=req-1"))).status,
    ).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("GET proxies the read-only status endpoint without the relayer key", async () => {
    fetchMock.mockResolvedValueOnce(
      json(200, {
        ok: true,
        mintRequestId: "req 1",
        status: "minted",
        tokenId: "59",
        txHash: "0x3",
      }),
    );
    const { GET } = await load();
    const res = await GET(new Request("http://admin.local/api/mint-proxy?mintRequestId=req%201"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      mintRequestId: "req 1",
      status: "minted",
      tokenId: "59",
      txHash: "0x3",
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://services.test/api/v1/assets/mint/req%201/status");
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer test-key");
    expect(headers["x-relayer-key"]).toBeUndefined();
  });
});
