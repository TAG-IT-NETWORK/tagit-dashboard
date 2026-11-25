// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchAdminRole,
  parseRoleResponse,
  parseRosterResponse,
  sessionIdentity,
} from "../admin-role";
import { evaluateAccess, readBusinessClaim } from "../rbac";

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
        new Response(
          JSON.stringify({ ok: true, user: { email: "ops@tagit.network", role: "operator" } }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
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
    expect(url).toBe(
      "https://services.test/api/v1/admin/users/by-email/ops%2Bteam%40tagit.network",
    );
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

describe("parseRosterResponse", () => {
  it("carries the tenant scope next to the role, null for platform users", () => {
    expect(
      parseRosterResponse(200, { ok: true, user: { role: "operator", businessId: "biz-acme" } }),
    ).toEqual({ role: "operator", businessId: "biz-acme" });
    expect(
      parseRosterResponse(200, { ok: true, user: { role: "admin", businessId: null } }),
    ).toEqual({ role: "admin", businessId: null });
    expect(parseRosterResponse(200, { ok: true, user: { role: "viewer" } })).toEqual({
      role: "viewer",
      businessId: null,
    });
    expect(parseRosterResponse(404, { ok: false })).toEqual({ role: null, businessId: null });
  });
});

// ── TAP-T17: a business id that cannot be read never reads as staff ─────────

describe("an unreadable business id drops the role", () => {
  const MALFORMED = [123, 0, true, false, "", {}, [], ["biz-a"], { id: "biz-a" }, "x".repeat(201)];

  it("in the roster answer", () => {
    for (const businessId of MALFORMED) {
      expect(
        parseRosterResponse(200, { ok: true, user: { role: "admin", businessId } }),
        JSON.stringify(businessId),
      ).toEqual({ role: null, businessId: null });
    }
  });

  it("in the session claims", () => {
    for (const businessId of MALFORMED) {
      expect(sessionIdentity({ role: "admin", businessId }), JSON.stringify(businessId)).toEqual({
        role: null,
        businessId: null,
      });
    }
  });

  it("keeps staff (null or absent) and brand (a plain id) as they are", () => {
    expect(sessionIdentity({ role: "admin", businessId: null })).toEqual({
      role: "admin",
      businessId: null,
    });
    expect(sessionIdentity({ role: "admin" })).toEqual({ role: "admin", businessId: null });
    expect(sessionIdentity({ role: "viewer", businessId: "biz-a" })).toEqual({
      role: "viewer",
      businessId: "biz-a",
    });
    expect(sessionIdentity({ role: "owner", businessId: null })).toEqual({
      role: null,
      businessId: null,
    });
    expect(sessionIdentity({})).toEqual({ role: null, businessId: null });
  });

  it("reads a claim three ways and nothing else", () => {
    expect(readBusinessClaim(null)).toEqual({ valid: true, businessId: null });
    expect(readBusinessClaim(undefined)).toEqual({ valid: true, businessId: null });
    expect(readBusinessClaim("biz-a")).toEqual({ valid: true, businessId: "biz-a" });
    expect(readBusinessClaim("x".repeat(200))).toEqual({
      valid: true,
      businessId: "x".repeat(200),
    });
    for (const raw of MALFORMED)
      expect(readBusinessClaim(raw), JSON.stringify(raw)).toEqual({ valid: false });
  });

  it("so an account with a broken brand record reaches nothing", () => {
    const { role, businessId } = sessionIdentity({ role: "admin", businessId: 123 });
    for (const path of ["/dashboard", "/brands", "/api/team-proxy", "/governance"]) {
      expect(evaluateAccess(path, { authenticated: true, role, tenant: businessId }), path).toBe(
        "forbidden",
      );
    }
  });
});
