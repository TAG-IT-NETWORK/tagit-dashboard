// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * /api/catalog-proxy/binding/verify — the SUN check every station bind runs
 * first. Upstream takes the token id as a JS number, so an id above
 * Number.MAX_SAFE_INTEGER would be rounded to a DIFFERENT token than the one
 * the relayer later binds. The proxy must refuse those (fail closed) and
 * forward safe ids exactly.
 */

const upstream = vi.fn(async (_path: string, _init: unknown) => ({
  status: 200,
  body: { verified: true, cmacVerified: true },
}));
vi.mock("@/lib/server/templates-upstream", () => ({
  templatesUpstream: (path: string, init: unknown) => upstream(path, init),
}));
const roleState: { role: string } = { role: "editor" };
vi.mock("@/lib/actor-role", () => ({ getActorRole: vi.fn(async () => roleState.role) }));

const NFC = { uid: "0x04a1b2c3d4e5f6", cmac: "0x0102030405060708", counter: 10 };

function post(body: unknown): Request {
  return new Request("http://admin.local/api/catalog-proxy/binding/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/catalog-proxy/binding/verify — token id range", () => {
  beforeEach(() => {
    upstream.mockClear();
    roleState.role = "editor";
  });

  it("refuses a viewer before anything reaches upstream", async () => {
    roleState.role = "viewer";
    const { POST } = await import("../catalog-proxy/binding/verify/route");
    const res = await POST(post({ tokenId: "59", nfcPayload: NFC }));
    expect(res.status).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("forwards a normal token id exactly", async () => {
    const { POST } = await import("../catalog-proxy/binding/verify/route");
    const res = await POST(post({ tokenId: "59", nfcPayload: NFC }));
    expect(res.status).toBe(200);
    expect(upstream).toHaveBeenCalledTimes(1);
    expect((upstream.mock.calls[0][1] as { body: { tokenId: number } }).body.tokenId).toBe(59);
  });

  it("accepts the largest safe id without rounding", async () => {
    const { POST } = await import("../catalog-proxy/binding/verify/route");
    const max = String(Number.MAX_SAFE_INTEGER);
    const res = await POST(post({ tokenId: max, nfcPayload: NFC }));
    expect(res.status).toBe(200);
    expect(String((upstream.mock.calls[0][1] as { body: { tokenId: number } }).body.tokenId)).toBe(
      max,
    );
  });

  it("refuses an id above MAX_SAFE_INTEGER and never calls upstream", async () => {
    const { POST } = await import("../catalog-proxy/binding/verify/route");
    for (const tokenId of [(BigInt(Number.MAX_SAFE_INTEGER) + 1n).toString(), "1".repeat(78)]) {
      const res = await POST(post({ tokenId, nfcPayload: NFC }));
      expect(res.status).toBe(400);
    }
    expect(upstream).not.toHaveBeenCalled();
  });
});
