// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Unit tests for the media-proxy route handler: multipart pass-through with
 * the admin API key injected SERVER-SIDE only. Mocked fetch — no live
 * services, no network. WB-07: the route re-checks the session role in-route
 * (operator+), so the actor-role seam is mocked to an editor by default.
 */

const TEST_KEY = "test-admin-key-do-not-leak";

const actorRoleMock = vi.hoisted(() => ({
  role: "editor" as "admin" | "editor" | "viewer" | null,
}));
vi.mock("@/lib/actor-role", () => ({
  getActorRole: async () => actorRoleMock.role,
}));

async function loadHandler() {
  // Re-import fresh so the module reads the current env.
  vi.resetModules();
  const mod = await import("../media-proxy/route");
  return mod.POST;
}

function multipartRequest(body = "----boundary\r\ncontent\r\n----boundary--"): Request {
  return new Request("http://admin.local/api/media-proxy", {
    method: "POST",
    headers: { "content-type": "multipart/form-data; boundary=--boundary" },
    body,
  });
}

describe("POST /api/media-proxy", () => {
  const originalEnv = { ...process.env };
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    actorRoleMock.role = "editor";
    process.env.SERVICES_API_KEY = TEST_KEY;
    process.env.SERVICES_URL = "https://services.test";
    fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true, sha256: "a".repeat(64), mime: "image/webp" }), {
          status: 201,
          headers: { "content-type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
  });

  it("forwards the multipart body upstream with the exact content-type boundary", async () => {
    const POST = await loadHandler();
    const res = await POST(multipartRequest());
    expect(res.status).toBe(201);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { duplex?: string }];
    expect(url).toBe("https://services.test/api/v1/media");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["content-type"]).toBe(
      "multipart/form-data; boundary=--boundary",
    );
    expect(init.body).toBeTruthy(); // streamed body forwarded
  });

  it("adds the admin API key server-side", async () => {
    const POST = await loadHandler();
    await POST(multipartRequest());
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).authorization).toBe(`Bearer ${TEST_KEY}`);
  });

  it("NEVER exposes the key in the response body or headers", async () => {
    const POST = await loadHandler();
    const res = await POST(multipartRequest());
    const text = await res.text();
    expect(text).not.toContain(TEST_KEY);
    for (const [, value] of res.headers.entries()) {
      expect(value).not.toContain(TEST_KEY);
    }
  });

  it("passes the upstream response body/status through verbatim", async () => {
    const POST = await loadHandler();
    const res = await POST(multipartRequest());
    expect(await res.json()).toEqual({
      ok: true,
      sha256: "a".repeat(64),
      mime: "image/webp",
    });
  });

  it("returns 500 (and never calls upstream) when the key is not configured", async () => {
    delete process.env.SERVICES_API_KEY;
    const POST = await loadHandler();
    const res = await POST(multipartRequest());
    expect(res.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects non-multipart requests without calling upstream", async () => {
    const POST = await loadHandler();
    const res = await POST(
      new Request("http://admin.local/api/media-proxy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
    );
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("WB-07: viewer role gets 403 without touching upstream", async () => {
    actorRoleMock.role = "viewer";
    const POST = await loadHandler();
    const res = await POST(multipartRequest());
    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("WB-07: role-less session (null) fails closed with 403", async () => {
    actorRoleMock.role = null;
    const POST = await loadHandler();
    const res = await POST(multipartRequest());
    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("WB-07: admin passes the in-route gate", async () => {
    actorRoleMock.role = "admin";
    const POST = await loadHandler();
    const res = await POST(multipartRequest());
    expect(res.status).toBe(201);
  });

  it("maps upstream network failure to 502 without leaking the key", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const POST = await loadHandler();
    const res = await POST(multipartRequest());
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain(TEST_KEY);
  });
});
