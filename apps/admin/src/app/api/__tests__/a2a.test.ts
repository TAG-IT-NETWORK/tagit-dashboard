// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * TAP-T02: /api/a2a relays a task to the agent gateway with the server's key.
 * It answered anyone; it now needs a signed-in session, checked in the route
 * as well as in the middleware, and it never falls back to a built-in key.
 */

const TEST_KEY = "test-services-key-do-not-leak";

const authState: { session: unknown } = { session: null };
vi.mock("@/auth", () => ({
  auth: vi.fn(async () => authState.session),
}));

async function post(body: unknown) {
  vi.resetModules();
  const { POST } = await import("../a2a/route");
  return POST(
    new Request("http://admin.local/api/a2a", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }) as never,
  );
}

const TASK = { payload: { jsonrpc: "2.0", id: 1, method: "tasks/send", params: {} } };

describe("/api/a2a", () => {
  const originalEnv = { ...process.env };
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.SERVICES_API_KEY = TEST_KEY;
    delete process.env.API_KEY;
    delete process.env.A2A_API_KEY;
    delete process.env.A2A_GATEWAY_URL;
    authState.session = { user: { email: "Ops@TagIt.Network", role: "viewer", businessId: null } };
    fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: {} }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
  });

  it("refuses a caller with no session, and relays nothing", async () => {
    authState.session = null;

    const res = await post(TASK);

    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("relays a signed-in caller's task with the server key and the caller's name", async () => {
    const res = await post(TASK);

    expect(res.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.tagit.network/a2a");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${TEST_KEY}`);
    expect(headers["x-actor"]).toBe("ops@tagit.network");
    expect(headers["x-business-id"]).toBeUndefined();
    expect(JSON.parse(String(init.body))).toEqual(TASK.payload);
  });

  it("marks a brand user's task with the brand", async () => {
    authState.session = {
      user: { email: "boss@brand.example", role: "viewer", businessId: "biz-a" },
    };

    await post(TASK);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["x-business-id"]).toBe("biz-a");
  });

  it("has no built-in key: without one configured it relays nothing", async () => {
    delete process.env.SERVICES_API_KEY;

    const res = await post(TASK);

    expect(res.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not echo the key in an error", async () => {
    fetchMock.mockResolvedValueOnce(new Response("upstream said no", { status: 502 }));

    const res = await post(TASK);

    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain(TEST_KEY);
  });
});
