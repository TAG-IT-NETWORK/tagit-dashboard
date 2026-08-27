// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * META-T32: /api/team-proxy — admin_users CRUD pass-through. Verifies the
 * three security properties end-to-end at the handler level:
 *  1. session gate IN the route (defense in depth behind the middleware):
 *     401 unauthenticated, 403 below admin — upstream never called;
 *  2. the services key is injected server-side and never leaks;
 *  3. X-Actor carries the signed-in email on every forwarded call (REQ-S-16).
 */

const TEST_KEY = "test-admin-key-do-not-leak";

// Controllable session for the mocked @/auth used by src/lib/team-proxy.ts.
const authState: { session: unknown } = { session: null };
vi.mock("@/auth", () => ({
  auth: vi.fn(async () => authState.session),
}));

const ADMIN_SESSION = { user: { email: "Info@TagIt.Network", role: "admin" } };

async function loadRoutes() {
  vi.resetModules();
  const list = await import("../team-proxy/route");
  const item = await import("../team-proxy/[email]/route");
  return { GET: list.GET, POST: list.POST, PUT: item.PUT, DELETE: item.DELETE };
}

function jsonRequest(method: string, body: unknown): Request {
  return new Request("http://admin.local/api/team-proxy", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/team-proxy", () => {
  const originalEnv = { ...process.env };
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.SERVICES_API_KEY = TEST_KEY;
    process.env.SERVICES_URL = "https://services.test";
    authState.session = ADMIN_SESSION;
    fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true, count: 0, users: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
  });

  it("401s an unauthenticated caller without touching upstream", async () => {
    authState.session = null;
    const { GET } = await loadRoutes();
    const res = await GET();
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["viewer", "operator", null])(
    "403s role %p without touching upstream (admin only)",
    async (role) => {
      authState.session = { user: { email: "ops@tagit.network", role } };
      const { GET } = await loadRoutes();
      const res = await GET();
      expect(res.status).toBe(403);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("GET forwards to the roster list with the key + lowercased X-Actor", async () => {
    const { GET } = await loadRoutes();
    const res = await GET();
    expect(res.status).toBe(200);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://services.test/api/v1/admin/users");
    expect(init.method).toBe("GET");
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe(`Bearer ${TEST_KEY}`);
    expect(headers["x-actor"]).toBe("info@tagit.network");
  });

  it("POST forwards the enroll body verbatim as JSON", async () => {
    const { POST } = await loadRoutes();
    const body = { email: "new@tagit.network", role: "viewer" };
    await POST(jsonRequest("POST", body));

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://services.test/api/v1/admin/users");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["content-type"]).toBe("application/json");
    expect(JSON.parse(String(init.body))).toEqual(body);
  });

  it("POST 400s malformed JSON without calling upstream", async () => {
    const { POST } = await loadRoutes();
    const res = await POST(
      new Request("http://admin.local/api/team-proxy", { method: "POST", body: "{nope" }),
    );
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("PUT targets the URL-encoded per-user path", async () => {
    const { PUT } = await loadRoutes();
    await PUT(jsonRequest("PUT", { role: "operator" }), {
      params: { email: "ops+x@tagit.network" },
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://services.test/api/v1/admin/users/ops%2Bx%40tagit.network");
    expect(init.method).toBe("PUT");
  });

  it("DELETE targets the per-user path with X-Actor and no body", async () => {
    const { DELETE } = await loadRoutes();
    await DELETE(new Request("http://admin.local/api/team-proxy/x", { method: "DELETE" }), {
      params: { email: "old@tagit.network" },
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { body?: unknown }];
    expect(url).toBe("https://services.test/api/v1/admin/users/old%40tagit.network");
    expect(init.method).toBe("DELETE");
    expect(init.body).toBeUndefined();
    expect((init.headers as Record<string, string>)["x-actor"]).toBe("info@tagit.network");
  });

  it("passes upstream status + body through verbatim (e.g. LAST_ADMIN 409)", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false, error: "LAST_ADMIN" }), { status: 409 }),
    );
    const { DELETE } = await loadRoutes();
    const res = await DELETE(
      new Request("http://admin.local/api/team-proxy/x", { method: "DELETE" }),
      { params: { email: "info@tagit.network" } },
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, error: "LAST_ADMIN" });
  });

  it("500s (no upstream call) when SERVICES_API_KEY is missing", async () => {
    delete process.env.SERVICES_API_KEY;
    const { GET } = await loadRoutes();
    const res = await GET();
    expect(res.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps network failure to 502 and NEVER leaks the key", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const { GET } = await loadRoutes();
    const res = await GET();
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain(TEST_KEY);
  });

  it("never exposes the key in any response", async () => {
    const { GET } = await loadRoutes();
    const res = await GET();
    expect(await res.text()).not.toContain(TEST_KEY);
    for (const [, value] of res.headers.entries()) {
      expect(value).not.toContain(TEST_KEY);
    }
  });
});
