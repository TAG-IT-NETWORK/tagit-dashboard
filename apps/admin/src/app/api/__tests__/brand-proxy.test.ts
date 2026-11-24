// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ACTING_BRAND_COOKIE, parseBusinessId, resolveTenant } from "@/lib/acting-brand";
import { evaluateAccess } from "@/lib/rbac";

/**
 * TAP-T16: brand records and "create for a brand", at the console's server.
 *
 * What these hold the console to:
 *  1. Only a platform admin reaches the brand routes or the switch. A brand
 *     user cannot, whatever their role, and nothing is sent upstream.
 *  2. The brand routes never carry a business id: they are the platform's own
 *     calls even while the admin is creating for a brand.
 *  3. The switch only takes a brand that exists, and only a platform admin's
 *     choice ever changes which business a services call is made under.
 */

const TEST_KEY = "test-admin-key-do-not-leak";

const authState: { session: unknown } = { session: null };
vi.mock("@/auth", () => ({
  auth: vi.fn(async () => authState.session),
}));

const cookieState: { value: string | undefined } = { value: undefined };
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      name === ACTING_BRAND_COOKIE && cookieState.value !== undefined
        ? { name, value: cookieState.value }
        : undefined,
  })),
}));

const PLATFORM_ADMIN = { user: { email: "Info@TagIt.Network", role: "admin", businessId: null } };
const PLATFORM_OPERATOR = { user: { email: "ops@tagit.network", role: "operator" } };
const BRAND_ADMIN = { user: { email: "boss@aurora.example", role: "admin", businessId: "aurora" } };

async function routes() {
  vi.resetModules();
  const list = await import("../brand-proxy/route");
  const one = await import("../brand-proxy/[id]/route");
  const assign = await import("../brand-proxy/[id]/assign/route");
  const acting = await import("../brand-proxy/acting/route");
  const unassigned = await import("../brand-proxy/unassigned/route");
  return { list, one, assign, acting, unassigned };
}

const jsonRequest = (method: string, body: unknown) =>
  new Request("http://admin.local/api/brand-proxy", {
    method,
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("/api/brand-proxy", () => {
  const originalEnv = { ...process.env };
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.SERVICES_API_KEY = TEST_KEY;
    process.env.SERVICES_URL = "https://services.test";
    authState.session = PLATFORM_ADMIN;
    cookieState.value = undefined;
    fetchMock = vi.fn(async () => reply({ ok: true, businesses: [] }));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
  });

  const everyCall = async () => {
    const r = await routes();
    return [
      () => r.list.GET(),
      () => r.list.POST(jsonRequest("POST", { id: "aurora", name: "Aurora" })),
      () => r.one.PUT(jsonRequest("PUT", { name: "Aurora" }), ctx("aurora")),
      () => r.assign.POST(jsonRequest("POST", { templateIds: ["tpl_1"] }), ctx("aurora")),
      () => r.acting.GET(),
      () => r.acting.POST(jsonRequest("POST", { businessId: "aurora" })),
      () => r.unassigned.GET(),
    ];
  };

  it("answers 401 to everyone who is not signed in, and sends nothing upstream", async () => {
    authState.session = null;
    for (const call of await everyCall()) expect((await call()).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["a brand admin", BRAND_ADMIN],
    [
      "a brand operator",
      { user: { email: "x@aurora.example", role: "operator", businessId: "aurora" } },
    ],
    ["a platform operator", PLATFORM_OPERATOR],
    ["a platform viewer", { user: { email: "v@tagit.network", role: "viewer" } }],
    ["a signed-in user with no role", { user: { email: "n@tagit.network", role: null } }],
  ])("answers 403 to %s on every route, and sends nothing upstream", async (_who, session) => {
    authState.session = session;
    for (const call of await everyCall()) {
      const res = await call();
      expect(res.status).toBe(403);
      expect(res.headers.get("set-cookie")).toBeNull();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards as the platform: the key, the admin's email, and never a business id", async () => {
    // Even while this admin is creating for a brand.
    cookieState.value = "aurora";
    const r = await routes();
    await r.list.GET();
    await r.list.POST(jsonRequest("POST", { id: "nova", name: "Nova" }));
    await r.one.PUT(jsonRequest("PUT", { name: "Nova 2" }), ctx("nova"));
    await r.assign.POST(jsonRequest("POST", { templateIds: ["tpl_1"] }), ctx("nova"));
    await r.unassigned.GET();

    expect(fetchMock).toHaveBeenCalledTimes(5);
    const seen = fetchMock.mock.calls.map(([url, init]) => {
      const headers = (init as RequestInit).headers as Record<string, string>;
      expect(headers.authorization).toBe(`Bearer ${TEST_KEY}`);
      expect(headers["x-actor"]).toBe("info@tagit.network");
      expect(Object.keys(headers).map((h) => h.toLowerCase())).not.toContain("x-business-id");
      return `${(init as RequestInit).method} ${String(url)}`;
    });
    expect(seen).toEqual([
      "GET https://services.test/api/v1/admin/businesses",
      "POST https://services.test/api/v1/admin/businesses",
      "PUT https://services.test/api/v1/admin/businesses/nova",
      "POST https://services.test/api/v1/admin/businesses/nova/assign",
      "GET https://services.test/api/v1/admin/templates",
    ]);
  });

  it("re-encodes the brand id in the path", async () => {
    const r = await routes();
    await r.one.PUT(jsonRequest("PUT", { name: "X" }), ctx("../users/x?y=1"));
    expect(String(fetchMock.mock.calls[0]![0])).toBe(
      "https://services.test/api/v1/admin/businesses/..%2Fusers%2Fx%3Fy%3D1",
    );
  });

  it("passes upstream's status and body through, and 400s a body that is not JSON", async () => {
    const r = await routes();
    fetchMock.mockResolvedValueOnce(reply({ ok: false, error: "BUSINESS_EXISTS" }, 409));
    const dup = await r.list.POST(jsonRequest("POST", { id: "aurora", name: "A" }));
    expect(dup.status).toBe(409);
    expect(await dup.json()).toEqual({ ok: false, error: "BUSINESS_EXISTS" });

    const bad = await r.list.POST(jsonRequest("POST", "{nope"));
    expect(bad.status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never repeats an error's own words or the key", async () => {
    const r = await routes();
    fetchMock.mockRejectedValueOnce(new Error(`connect ECONNREFUSED db.internal ${TEST_KEY}`));
    const down = await r.list.GET();
    expect(down.status).toBe(502);
    const text = await down.text();
    expect(text).not.toContain("ECONNREFUSED");
    expect(text).not.toContain(TEST_KEY);

    fetchMock.mockResolvedValueOnce(new Response("<html>bad gateway</html>", { status: 502 }));
    expect(await (await r.list.GET()).json()).toEqual({ ok: false, error: "UPSTREAM_FAILED" });

    delete process.env.SERVICES_API_KEY;
    const unset = await (await routes()).list.GET();
    expect(unset.status).toBe(503);
  });

  it("lists only templates that are explicitly no-brand, reduced to four fields", async () => {
    fetchMock.mockResolvedValueOnce(
      reply({
        ok: true,
        templates: [
          {
            id: "tpl_FREE",
            name: "Free",
            sku: "S1",
            status: "published",
            businessId: null,
            createdBy: "x",
          },
          { id: "tpl_AURORA", name: "Theirs", businessId: "aurora" },
          { id: "tpl_UNKNOWN", name: "No field" },
          { name: "No id", businessId: null },
          "junk",
        ],
      }),
    );
    const res = await (await routes()).unassigned.GET();
    expect(await res.json()).toEqual({
      ok: true,
      templates: [{ id: "tpl_FREE", name: "Free", sku: "S1", status: "published" }],
    });
  });
});

describe("/api/brand-proxy/acting: choosing a brand to create for", () => {
  const originalEnv = { ...process.env };
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.SERVICES_API_KEY = TEST_KEY;
    process.env.SERVICES_URL = "https://services.test";
    authState.session = PLATFORM_ADMIN;
    cookieState.value = undefined;
    fetchMock = vi.fn(async () =>
      reply({ ok: true, business: { id: "aurora", name: "Aurora Skin" } }),
    );
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
  });

  it("looks the brand up first, then sets a cookie the page cannot read", async () => {
    const { acting } = await routes();
    const res = await acting.POST(jsonRequest("POST", { businessId: "aurora" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, acting: "aurora", name: "Aurora Skin" });
    expect(String(fetchMock.mock.calls[0]![0])).toBe(
      "https://services.test/api/v1/admin/businesses/aurora",
    );
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${ACTING_BRAND_COOKIE}=aurora`);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).toMatch(/Max-Age=28800/);
  });

  it("refuses a brand that does not exist, and sets no cookie", async () => {
    const { acting } = await routes();
    fetchMock.mockResolvedValueOnce(reply({ ok: false, error: "NOT_FOUND" }, 404));
    const res = await acting.POST(jsonRequest("POST", { businessId: "aurora-typo" }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, error: "UNKNOWN_BUSINESS" });
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("sets no cookie when the lookup fails or answers about another brand", async () => {
    const { acting } = await routes();
    fetchMock.mockResolvedValueOnce(reply({ ok: true, business: { id: "other", name: "Other" } }));
    const mismatch = await acting.POST(jsonRequest("POST", { businessId: "aurora" }));
    fetchMock.mockRejectedValueOnce(new Error("down"));
    const down = await acting.POST(jsonRequest("POST", { businessId: "aurora" }));
    for (const res of [mismatch, down]) {
      expect(res.status).toBe(502);
      expect(res.headers.get("set-cookie")).toBeNull();
    }
  });

  it.each([undefined, "", 7, {}, "a b", "x\r\nx-injected: 1", "../aurora", "a".repeat(201)])(
    "refuses %j as a brand id without asking upstream",
    async (businessId) => {
      const { acting } = await routes();
      const res = await acting.POST(jsonRequest("POST", { businessId }));
      expect(res.status).toBe(400);
      expect(res.headers.get("set-cookie")).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("stops with businessId null: the cookie is cleared, nothing is asked upstream", async () => {
    cookieState.value = "aurora";
    const { acting } = await routes();
    const res = await acting.POST(jsonRequest("POST", { businessId: null }));
    expect(await res.json()).toEqual({ ok: true, acting: null });
    expect(res.headers.get("set-cookie")).toMatch(
      new RegExp(`${ACTING_BRAND_COOKIE}=;.*Max-Age=0`, "i"),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says which brand is being created for, or none", async () => {
    const { acting } = await routes();
    expect(await (await acting.GET()).json()).toEqual({ ok: true, acting: null });
    cookieState.value = "aurora";
    expect(await (await acting.GET()).json()).toEqual({ ok: true, acting: "aurora" });
  });
});

describe("which business a services call is made under", () => {
  beforeEach(() => {
    cookieState.value = undefined;
  });
  const context = async () => {
    vi.resetModules();
    const { getTenantContext, getTenant, getSessionTenant } = await import("@/lib/actor");
    return {
      context: await getTenantContext(),
      tenant: await getTenant(),
      session: await getSessionTenant(),
    };
  };

  it("a platform admin's choice is used", async () => {
    authState.session = PLATFORM_ADMIN;
    cookieState.value = "aurora";
    expect(await context()).toEqual({
      context: { tenant: "aurora", acting: true },
      tenant: "aurora",
      // Who they ARE does not change: the menu stays the platform's.
      session: null,
    });
  });

  it("a brand user's own business always wins: the cookie cannot switch them", async () => {
    authState.session = BRAND_ADMIN;
    cookieState.value = "another-brand";
    expect(await context()).toEqual({
      context: { tenant: "aurora", acting: false },
      tenant: "aurora",
      session: "aurora",
    });
  });

  it.each([
    ["a platform operator", PLATFORM_OPERATOR],
    ["a platform viewer", { user: { email: "v@tagit.network", role: "viewer" } }],
    ["nobody signed in", null],
  ])("the cookie means nothing for %s", async (_who, session) => {
    authState.session = session;
    cookieState.value = "aurora";
    expect((await context()).tenant).toBeNull();
  });

  it("a cookie that is not a business id is ignored", async () => {
    authState.session = PLATFORM_ADMIN;
    for (const value of ["", "a b", "x\nx-business-id: other", "../x", "ü"]) {
      cookieState.value = value;
      expect((await context()).context).toEqual({ tenant: null, acting: false });
    }
  });

  it("the catalog and batch proxies then create under the chosen brand", async () => {
    authState.session = PLATFORM_ADMIN;
    cookieState.value = "aurora";
    process.env.SERVICES_API_KEY = TEST_KEY;
    const fetchMock = vi.fn(async () => reply({ ok: true, template: { id: "tpl_1" } }, 201));
    vi.stubGlobal("fetch", fetchMock);
    vi.resetModules();
    const { templatesUpstream } = await import("@/lib/server/templates-upstream");
    const { batchesUpstream } = await import("@/lib/server/batches-upstream");
    await templatesUpstream("/api/v1/admin/templates", {
      method: "POST",
      body: { name: "For Aurora" },
    });
    await batchesUpstream("/api/v1/admin/batches", {
      method: "POST",
      body: { templateId: "tpl_1", size: 2 },
    });
    for (const [, init] of fetchMock.mock.calls) {
      expect(((init as RequestInit).headers as Record<string, string>)["x-business-id"]).toBe(
        "aurora",
      );
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Stopped: the same calls carry no brand again.
    cookieState.value = undefined;
    fetchMock.mockClear();
    vi.resetModules();
    const again = await import("@/lib/server/templates-upstream");
    await again.templatesUpstream("/api/v1/admin/templates", {
      method: "POST",
      body: { name: "Platform" },
    });
    expect(
      Object.keys((fetchMock.mock.calls[0]![1] as RequestInit).headers as Record<string, string>),
    ).not.toContain("x-business-id");
    vi.unstubAllGlobals();
    delete process.env.SERVICES_API_KEY;
  });
});

describe("resolveTenant and parseBusinessId (pure)", () => {
  it("covers the whole table", () => {
    const t = (
      sessionBusinessId: string | null,
      role: "viewer" | "operator" | "admin" | null,
      cookie?: string,
    ) => resolveTenant({ sessionBusinessId, role, actingCookie: cookie });
    expect(t(null, "admin")).toEqual({ tenant: null, acting: false });
    expect(t(null, "admin", "aurora")).toEqual({ tenant: "aurora", acting: true });
    expect(t(null, "operator", "aurora")).toEqual({ tenant: null, acting: false });
    expect(t(null, null, "aurora")).toEqual({ tenant: null, acting: false });
    expect(t("nova", "admin", "aurora")).toEqual({ tenant: "nova", acting: false });
    expect(t("nova", "viewer")).toEqual({ tenant: "nova", acting: false });
  });

  it("takes ids brands have and nothing that could leave a header", () => {
    for (const id of ["aurora", "aurora-skin", "biz_1", "Legacy.Brand", "a"]) {
      expect(parseBusinessId(id)).toBe(id);
    }
    for (const id of [
      "",
      " aurora",
      "a b",
      "a\nb",
      "a\rb",
      "a:b",
      "a/b",
      "-a",
      null,
      5,
      undefined,
    ]) {
      expect(parseBusinessId(id)).toBeNull();
    }
  });
});

describe("the access rules: brands are a platform admin's", () => {
  const paths = [
    "/brands",
    "/api/brand-proxy",
    "/api/brand-proxy/acting",
    "/api/brand-proxy/aurora/assign",
  ];

  it("a platform admin is let in", () => {
    for (const path of paths) {
      expect(
        evaluateAccess(path, { authenticated: true, role: "admin", tenant: null }, "POST"),
      ).toBe("allow");
    }
  });

  it("a brand session is refused, whatever its role", () => {
    for (const path of paths) {
      for (const role of ["viewer", "operator", "admin"] as const) {
        expect(evaluateAccess(path, { authenticated: true, role, tenant: "aurora" }, "POST")).toBe(
          "forbidden",
        );
        expect(evaluateAccess(path, { authenticated: true, role, tenant: "aurora" }, "GET")).toBe(
          "forbidden",
        );
      }
    }
  });

  it("a platform user below admin is refused", () => {
    for (const path of paths) {
      for (const role of ["viewer", "operator", null] as const) {
        expect(evaluateAccess(path, { authenticated: true, role, tenant: null }, "GET")).toBe(
          "forbidden",
        );
      }
    }
  });
});
