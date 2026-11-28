import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { evaluateAccess, type AccessSession, type Role } from "@/lib/access";
import {
  addBrandTeamMember,
  changeBrandTeamRole,
  getBrandTeam,
  removeBrandTeamMember,
} from "@/lib/brand-services";
import { toBrandSession } from "@/lib/brand-session";
import {
  canManageTeam,
  parseTeam,
  parseTeamAnswer,
  parseTeamEmail,
  parseTeamRole,
  teamProblem,
} from "@/lib/brand-team";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

/** A brand manages its own team (TAP-T17). */

describe("who may see and change the team", () => {
  it("a Manager, and nobody else", () => {
    expect(canManageTeam("admin")).toBe(true);
    expect(canManageTeam("operator")).toBe(false);
    expect(canManageTeam("viewer")).toBe(false);
    expect(canManageTeam(null)).toBe(false);
  });

  it("the gate closes /team to everyone but a Manager, on every method", () => {
    const as = (role: Role | null, brand: string | null = "acme"): AccessSession => ({
      authenticated: true,
      role,
      brand,
    });
    for (const method of [undefined, "GET", "POST", "PUT", "DELETE"]) {
      for (const path of ["/team", "/team/anything"]) {
        expect(evaluateAccess(path, as("admin"), method), `${method} ${path}`).toBe("allow");
        expect(evaluateAccess(path, as("operator"), method), `${method} ${path}`).toBe("forbidden");
        expect(evaluateAccess(path, as("viewer"), method), `${method} ${path}`).toBe("forbidden");
      }
    }
    expect(evaluateAccess("/team", as("admin", null))).toBe("no-access");
    expect(evaluateAccess("/team", { authenticated: false, role: null, brand: null })).toBe(
      "signin",
    );
    // Look-alikes are not the team page.
    expect(evaluateAccess("/teams", as("admin"))).toBe("home");
    expect(evaluateAccess("/api/team", as("admin"))).toBe("forbidden");
  });
});

describe("parseTeamEmail and parseTeamRole", () => {
  it("trim and lowercase a plain email", () => {
    expect(parseTeamEmail("  Jane.Doe@Acme.COM ")).toBe("jane.doe@acme.com");
    expect(parseTeamEmail("a@b.co")).toBe("a@b.co");
  });
  it("refuse anything that is not one plain email", () => {
    const rtl = String.fromCodePoint(0x202e);
    for (const bad of [
      "",
      "jane",
      "jane@acme",
      "@acme.com",
      "jane@",
      "jane doe@acme.com",
      "jane@acme.com, max@acme.com",
      "jane@@acme.com",
      "jane@acme.com\nx",
      `jane${rtl}@acme.com`,
      `${"a".repeat(320)}@acme.com`,
      5,
      null,
      undefined,
      ["jane@acme.com"],
    ]) {
      expect(parseTeamEmail(bad), String(bad)).toBeNull();
    }
  });
  it("take the three roles only", () => {
    expect(parseTeamRole("viewer")).toBe("viewer");
    expect(parseTeamRole("operator")).toBe("operator");
    expect(parseTeamRole("admin")).toBe("admin");
    for (const bad of ["owner", "Admin", "manager", "", "constructor", null, 2]) {
      expect(parseTeamRole(bad), String(bad)).toBeNull();
    }
  });
});

describe("parseTeam", () => {
  const u = (email: unknown, role: unknown, businessId: unknown = "acme") => ({
    email,
    role,
    businessId,
    createdBy: "x",
  });
  const read = (users: unknown) => parseTeam(200, { ok: true, users }, "acme");

  it("shows the brand's people, Managers first, then by email", () => {
    expect(
      read([
        u("zed@acme.com", "viewer"),
        u("Ed@acme.com", "operator"),
        u("mia@acme.com", "admin"),
        u("amy@acme.com", "admin"),
      ]),
    ).toEqual([
      { email: "amy@acme.com", role: "admin" },
      { email: "mia@acme.com", role: "admin" },
      { email: "ed@acme.com", role: "operator" },
      { email: "zed@acme.com", role: "viewer" },
    ]);
  });

  it("never shows a person of another brand or of none, a repeat, or a row it cannot read", () => {
    expect(
      read([
        u("spy@globex.com", "admin", "globex"),
        u("staff@tagit.network", "admin", null),
        { email: "nobrand@x.com", role: "admin" },
        u("mia@acme.com", "admin"),
        u("MIA@acme.com", "viewer"),
        u("odd@acme.com", "owner"),
        u("not an email", "viewer"),
        u(5, "viewer"),
        null,
        "x",
      ]),
    ).toEqual([{ email: "mia@acme.com", role: "admin" }]);
  });

  it("says it could not load rather than 'nobody'", () => {
    expect(parseTeam(500, { ok: true, users: [] }, "acme")).toBeNull();
    expect(parseTeam(200, { ok: false, users: [] }, "acme")).toBeNull();
    expect(parseTeam(200, { ok: true }, "acme")).toBeNull();
    expect(parseTeam(403, null, "acme")).toBeNull();
    expect(read([])).toEqual([]);
  });
});

describe("parseTeamAnswer", () => {
  const user = (over: Record<string, unknown> = {}) => ({
    email: "ed@acme.com",
    role: "operator",
    businessId: "acme",
    ...over,
  });
  const add = (status: number, body: unknown) =>
    parseTeamAnswer(status, body, "add", "ed@acme.com", "acme", "operator");

  it("is done only when the answer names this person, this brand and this role", () => {
    expect(add(201, { ok: true, user: user() })).toEqual({ kind: "done" });
    expect(
      parseTeamAnswer(200, { ok: true, user: user() }, "change", "ed@acme.com", "acme", "operator"),
    ).toEqual({ kind: "done" });
    expect(
      parseTeamAnswer(
        200,
        { ok: true, email: "ed@acme.com" },
        "remove",
        "ed@acme.com",
        "acme",
        null,
      ),
    ).toEqual({ kind: "done" });
    for (const body of [
      { ok: true, user: user({ businessId: "globex" }) },
      { ok: true, user: user({ businessId: null }) },
      { ok: true, user: user({ role: "admin" }) },
      { ok: true, user: user({ email: "other@acme.com" }) },
      { ok: true },
      { ok: true, user: "x" },
    ]) {
      expect(add(201, body), JSON.stringify(body)).toEqual({ kind: "failed" });
    }
    expect(add(200, { ok: true, user: user() })).toEqual({ kind: "failed" });
    expect(
      parseTeamAnswer(201, { ok: true, user: user() }, "change", "ed@acme.com", "acme", "operator"),
    ).toEqual({ kind: "failed" });
    expect(
      parseTeamAnswer(
        200,
        { ok: true, email: "x@acme.com" },
        "remove",
        "ed@acme.com",
        "acme",
        null,
      ),
    ).toEqual({ kind: "failed" });
  });

  it("reads the refusals it knows and calls the rest failed", () => {
    expect(add(409, { error: "ADMIN_USER_EXISTS" })).toEqual({ kind: "already" });
    expect(add(409, { error: "BRAND_TEAM_FULL" })).toEqual({ kind: "full" });
    expect(add(403, { error: "BRAND_TEAM_MANAGERS_ONLY" })).toEqual({ kind: "not-allowed" });
    expect(
      add(400, { error: "VALIDATION_ERROR", message: "'x' is not a valid email address" }),
    ).toEqual({ kind: "cannot-add" });
    expect(
      parseTeamAnswer(409, { error: "BRAND_TEAM_SELF" }, "change", "a@b.co", "acme", "admin"),
    ).toEqual({ kind: "self" });
    expect(parseTeamAnswer(404, { error: "NOT_FOUND" }, "remove", "a@b.co", "acme", null)).toEqual({
      kind: "gone",
    });
    expect(
      parseTeamAnswer(400, { error: "VALIDATION_ERROR" }, "change", "a@b.co", "acme", "admin"),
    ).toEqual({ kind: "failed" });
    for (const [status, body] of [
      [403, { error: "BRAND_APP_ROUTE_FORBIDDEN" }],
      [409, { error: "PROTECTED_ADMIN" }],
      [500, { error: "x" }],
      [201, null],
      [0, null],
    ] as Array<[number, unknown]>) {
      expect(add(status, body), String(status)).toEqual({ kind: "failed" });
    }
  });

  it("explains each refusal in plain words", () => {
    for (const kind of [
      "already",
      "cannot-add",
      "full",
      "self",
      "not-allowed",
      "gone",
      "failed",
    ] as const) {
      const words = teamProblem({ kind });
      expect(words.length).toBeGreaterThan(20);
      expect(words).not.toMatch(/roster|admin_user|businessId|operator|BRAND_|VALIDATION/);
    }
    // It must not say whether the person has an account elsewhere.
    expect(teamProblem({ kind: "cannot-add" })).toContain("may already");
  });
});

describe("the calls to tagit-services", () => {
  const manager = toBrandSession({ email: "mia@acme.com", role: "admin", businessId: "acme" })!;
  const fetchMock = vi.fn();
  const answer = (status: number, body: unknown) =>
    Promise.resolve(new Response(JSON.stringify(body), { status }));
  const sent = (call = 0) => {
    const [url, init] = fetchMock.mock.calls[call] as [string, RequestInit];
    return {
      url,
      method: init.method,
      headers: init.headers as Record<string, string>,
      body: init.body,
    };
  };
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("SERVICES_API_KEY", "test-key");
    vi.stubEnv("SERVICES_URL", "https://services.test/");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("read the team under the session's brand", async () => {
    fetchMock.mockReturnValue(
      answer(200, {
        ok: true,
        users: [
          { email: "mia@acme.com", role: "admin", businessId: "acme" },
          { email: "x@globex.com", role: "admin", businessId: "globex" },
        ],
      }),
    );
    expect(await getBrandTeam(manager)).toEqual([{ email: "mia@acme.com", role: "admin" }]);
    expect(sent().url).toBe("https://services.test/api/v1/admin/users");
    expect(sent().method).toBe("GET");
    expect(sent().headers["x-business-id"]).toBe("acme");
  });

  it("add a person with an email and a role and NO brand, as the signed-in Manager", async () => {
    fetchMock.mockReturnValue(
      answer(201, {
        ok: true,
        user: { email: "ed@acme.com", role: "operator", businessId: "acme" },
      }),
    );
    expect(await addBrandTeamMember(manager, " Ed@Acme.com ", "operator")).toEqual({
      kind: "done",
    });
    expect(sent().url).toBe("https://services.test/api/v1/admin/users");
    expect(sent().method).toBe("POST");
    expect(JSON.parse(String(sent().body))).toEqual({ email: "ed@acme.com", role: "operator" });
    expect(sent().headers).toMatchObject({ "x-business-id": "acme", "x-actor": "mia@acme.com" });
  });

  it("change a role and remove a person at that person's own address, escaped", async () => {
    fetchMock.mockReturnValue(
      answer(200, {
        ok: true,
        user: { email: "ed+x@acme.com", role: "admin", businessId: "acme" },
      }),
    );
    expect(await changeBrandTeamRole(manager, "ed+x@acme.com", "admin")).toEqual({ kind: "done" });
    expect(sent().url).toBe("https://services.test/api/v1/admin/users/ed%2Bx%40acme.com");
    expect(sent().method).toBe("PUT");
    expect(sent().body).toBe('{"role":"admin"}');

    fetchMock.mockReset();
    fetchMock.mockReturnValue(answer(200, { ok: true, email: "ed+x@acme.com" }));
    expect(await removeBrandTeamMember(manager, "ed+x@acme.com")).toEqual({ kind: "done" });
    expect(sent().method).toBe("DELETE");
    expect(sent().body).toBeUndefined();
  });

  it("address a person by their email in its plain lowercase form, however it was typed", async () => {
    fetchMock.mockReturnValue(answer(200, { ok: true, email: "ed@acme.com" }));
    expect(await removeBrandTeamMember(manager, "  ED@Acme.com ")).toEqual({ kind: "done" });
    expect(sent().url).toBe("https://services.test/api/v1/admin/users/ed%40acme.com");
    fetchMock.mockReset();
    expect(await removeBrandTeamMember(manager, "ed@acme.com x")).toEqual({ kind: "failed" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never call out for a bad email or role", async () => {
    expect(await addBrandTeamMember(manager, "not an email", "viewer")).toEqual({ kind: "failed" });
    expect(await addBrandTeamMember(manager, "ed@acme.com", "owner")).toEqual({ kind: "failed" });
    expect(await changeBrandTeamRole(manager, "ed@acme.com/../x", "admin")).toEqual({
      kind: "failed",
    });
    expect(await changeBrandTeamRole(manager, "ed@acme.com", "")).toEqual({ kind: "failed" });
    expect(await removeBrandTeamMember(manager, "../users")).toEqual({ kind: "failed" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("report an outage as not done, and never throw", async () => {
    fetchMock.mockRejectedValue(new Error("down"));
    expect(await getBrandTeam(manager)).toBeNull();
    expect(await addBrandTeamMember(manager, "ed@acme.com", "viewer")).toEqual({ kind: "failed" });
    expect(await removeBrandTeamMember(manager, "ed@acme.com")).toEqual({ kind: "failed" });
  });
});
