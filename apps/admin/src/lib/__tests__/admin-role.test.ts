// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchAdminRole, parseRoleResponse } from "../admin-role";

/**
 * META-T32: role resolution against the services admin_users by-email
 * endpoint. Fail-closed everywhere — a lookup that cannot positively resolve
 * a role resolves null (no access).
 */

const TEST_KEY = "test-admin-key-do-not-leak";

describe("parseRoleResponse (pure)", () => {
  it("maps a healthy payload to its role", () => {
    for (const role of ["viewer", "operator", "admin"]) {
      expect(parseRoleResponse(200, { ok: true, user: { email: "a@b.co", role } })).toBe(role);
    }
  });

  it.each([
    [404, { ok: false, error: "NOT_FOUND" }],
    [200, { ok: false }],
    [200, { ok: true, user: { role: "superuser" } }],
    [200, { ok: true, user: {} }],
    [200, { ok: true }],
    [200, null],
    [200, "admin"],
    [500, { ok: true, user: { role: "admin" } }],
    [401, { ok: true, user: { role: "admin" } }],
  ])("fails closed on status %i with body %j", (status, body) => {
    expect(parseRoleResponse(status, body)).toBeNull();
  });
});

describe("fetchAdminRole", () => {
  const originalEnv = { ...process.env };
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.SERVICES_API_KEY = TEST_KEY;
    process.env.SERVICES_URL = "https://services.test";
    fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true, user: { email: "ops@tagit.network", role: "operator" } }), {
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

  it("resolves the role via the by-email endpoint with the key server-side", async () => {
    await expect(fetchAdminRole("ops@tagit.network")).resolves.toBe("operator");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://services.test/api/v1/admin/users/by-email/ops%40tagit.network");
    expect((init.headers as Record<string, string>).authorization).toBe(`Bearer ${TEST_KEY}`);
  });

  it("canonicalizes the email: trims, lowercases, URL-encodes", async () => {
    await fetchAdminRole("  Ops+Team@TagIt.Network ");
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("https://services.test/api/v1/admin/users/by-email/ops%2Bteam%40tagit.network");
  });

  it("resolves null for an unenrolled email (404)", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false, error: "NOT_FOUND" }), { status: 404 }),
    );
    await expect(fetchAdminRole("stranger@example.com")).resolves.toBeNull();
  });

  it("resolves null (and never fetches) without SERVICES_API_KEY", async () => {
    delete process.env.SERVICES_API_KEY;
    await expect(fetchAdminRole("ops@tagit.network")).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("resolves null on empty email without fetching", async () => {
    await expect(fetchAdminRole("   ")).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("resolves null on network failure (fail-closed, no throw)", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    await expect(fetchAdminRole("ops@tagit.network")).resolves.toBeNull();
  });

  it("resolves null on a non-JSON upstream body", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>gateway error</html>", { status: 200 }));
    await expect(fetchAdminRole("ops@tagit.network")).resolves.toBeNull();
  });
});
