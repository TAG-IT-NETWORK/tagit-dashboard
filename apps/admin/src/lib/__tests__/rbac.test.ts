// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  BRAND_APP_URL,
  isBrandTenant,
  evaluateAccess,
  hasRole,
  isApiPath,
  isGatedByMatcher,
  isPublicPath,
  isSessionOnlyPath,
  parseRole,
  requiredRoleFor,
  ROLES,
  type Role,
} from "../rbac";

/**
 * META-T32: the role map + middleware decision table, pinned as pure logic.
 * src/middleware.ts is a thin adapter over these functions — if a case here
 * changes, the live gate changed.
 */

describe("parseRole", () => {
  it("accepts exactly the three roles", () => {
    for (const role of ROLES) expect(parseRole(role)).toBe(role);
  });

  it.each([undefined, null, "", "Admin", "superuser", 1, {}, ["admin"]])("rejects %p", (value) => {
    expect(parseRole(value)).toBeNull();
  });
});

describe("hasRole (viewer < operator < admin)", () => {
  it("admin satisfies every requirement", () => {
    for (const required of ROLES) expect(hasRole("admin", required)).toBe(true);
  });

  it("operator satisfies viewer+operator but not admin", () => {
    expect(hasRole("operator", "viewer")).toBe(true);
    expect(hasRole("operator", "operator")).toBe(true);
    expect(hasRole("operator", "admin")).toBe(false);
  });

  it("viewer satisfies only viewer", () => {
    expect(hasRole("viewer", "viewer")).toBe(true);
    expect(hasRole("viewer", "operator")).toBe(false);
    expect(hasRole("viewer", "admin")).toBe(false);
  });

  it("null (unenrolled email) satisfies nothing", () => {
    for (const required of ROLES) expect(hasRole(null, required)).toBe(false);
  });
});

describe("requiredRoleFor — the per-path role map", () => {
  it.each<[string, Role]>([
    // viewer default — read-only pages
    ["/dashboard", "viewer"],
    ["/assets", "viewer"],
    ["/assets/123", "viewer"],
    ["/users", "viewer"],
    ["/governance", "viewer"],
    ["/", "viewer"],
    // META-T33/T36 read surfaces render read-only for viewers; catalog
    // WRITES are role-gated by method-scoped entries (WB-06) AND re-checked
    // inside /api/catalog-proxy — operator+ to mutate, admin to publish.
    ["/catalog", "viewer"],
    ["/catalog/tpl_42", "viewer"],
    // operator — drafts + media + batches + binding
    ["/assets/new", "operator"],
    ["/assembly-line", "operator"],
    ["/batch", "operator"],
    ["/batch/7/execute", "operator"],
    ["/bind", "operator"],
    ["/api/media-proxy", "operator"],
    ["/api/mint-proxy", "operator"],
    // META-T34/T35 write rails — reads on the same prefixes stay viewer
    // (wizard/station pages render read-only; proxies re-check server-side)
    ["/api/catalog-proxy/batches", "viewer"],
    ["/api/catalog-proxy/batches/bat_1", "viewer"],
    ["/api/catalog-proxy/batches/bat_1/export.csv", "viewer"],
    ["/api/catalog-proxy/batches/bat_1/execute", "operator"],
    ["/api/catalog-proxy/binding/bind", "operator"],
    ["/api/catalog-proxy/binding/verify", "operator"],
    ["/api/catalog-proxy/binding/reassign", "operator"],
    ["/api/catalog-proxy/binding/skip-defective", "operator"],
    ["/api/catalog-proxy/binding/exceptions", "viewer"],
    ["/api/catalog-proxy/batches/bat_1/unstick", "admin"],
    ["/api/catalog-proxy/binding/void-remint", "admin"],
    // WB-06: template lifecycle verbs are admin (any method — POST-only routes)
    ["/api/catalog-proxy/templates/tpl_42/publish", "admin"],
    ["/api/catalog-proxy/templates/tpl_42/archive", "admin"],
    ["/api/catalog-proxy/templates/tpl_42/propagate", "admin"],
    // admin — publish + prices + recovery + team
    ["/publish", "admin"],
    ["/prices", "admin"],
    ["/pricing", "admin"],
    ["/recovery", "admin"],
    ["/resolve", "admin"],
    ["/resolve/9", "admin"],
    ["/team", "admin"],
    ["/api/team-proxy", "admin"],
    ["/api/team-proxy/a%40b.com", "admin"],
  ])("%s needs %s", (pathname, role) => {
    expect(requiredRoleFor(pathname)).toBe(role);
  });

  it("longest prefix wins: templates/*/publish escalates above the POST templates entry", () => {
    expect(requiredRoleFor("/catalog")).toBe("viewer");
    expect(requiredRoleFor("/catalog/publishing-guide")).toBe("viewer"); // segment-safe
    // WB-06: the dead /catalog/publish page entry is gone — plain viewer path.
    expect(requiredRoleFor("/catalog/publish")).toBe("viewer");
    expect(requiredRoleFor("/api/catalog-proxy/templates/tpl_1/publish", "POST")).toBe("admin");
  });

  it("WB-06: method-scoped template create/update entries", () => {
    // GET list/detail through the proxy stays viewer-level (read surfaces).
    expect(requiredRoleFor("/api/catalog-proxy/templates", "GET")).toBe("viewer");
    expect(requiredRoleFor("/api/catalog-proxy/templates/tpl_1", "GET")).toBe("viewer");
    expect(requiredRoleFor("/api/catalog-proxy/templates/tpl_1/items", "GET")).toBe("viewer");
    // Create (POST collection) and update (PUT :id) are operator.
    expect(requiredRoleFor("/api/catalog-proxy/templates", "POST")).toBe("operator");
    expect(requiredRoleFor("/api/catalog-proxy/templates/tpl_1", "PUT")).toBe("operator");
    // lowercase method normalizes
    expect(requiredRoleFor("/api/catalog-proxy/templates", "post")).toBe("operator");
    // Unknown method (omitted) FAILS CLOSED: method-scoped entries apply.
    expect(requiredRoleFor("/api/catalog-proxy/templates")).toBe("operator");
  });

  it("matches whole path segments only (/teammates is NOT /team)", () => {
    expect(requiredRoleFor("/teammates")).toBe("viewer");
    expect(requiredRoleFor("/bindery")).toBe("viewer");
  });

  it("`*` matches exactly one non-empty segment (T34 batch action routes)", () => {
    // one id segment of any shape
    expect(requiredRoleFor("/api/catalog-proxy/batches/bat_abc123/execute")).toBe("operator");
    expect(requiredRoleFor("/api/catalog-proxy/batches/anything/unstick")).toBe("admin");
    // missing or empty id segment → no match, viewer default
    expect(requiredRoleFor("/api/catalog-proxy/batches/execute")).toBe("viewer");
    expect(requiredRoleFor("/api/catalog-proxy/batches//execute")).toBe("viewer");
    // wildcard is a segment matcher, not a substring one
    expect(requiredRoleFor("/api/catalog-proxy/batches/bat_1/executed")).toBe("viewer");
  });
});

describe("path classes", () => {
  it("public: only the sign-in surface and the crawler manifest", () => {
    for (const p of ["/api/auth/signin", "/api/auth/callback/google", "/api/farcaster-manifest"]) {
      expect(isPublicPath(p)).toBe(true);
    }
  });

  it("NOT public: pages and every route that holds a server-side key", () => {
    for (const p of [
      "/dashboard",
      "/team",
      "/api/media-proxy",
      "/api/mint-proxy",
      "/api/team-proxy",
      // TAP-T02: these two answered without a session.
      "/api/a2a",
      "/api/ipfs",
    ]) {
      expect(isPublicPath(p)).toBe(false);
    }
  });

  it("/403 is session-only (any signed-in role, even null)", () => {
    expect(isSessionOnlyPath("/403")).toBe(true);
    expect(isSessionOnlyPath("/dashboard")).toBe(false);
  });

  it("isApiPath separates transport (JSON vs redirect)", () => {
    expect(isApiPath("/api/team-proxy")).toBe(true);
    expect(isApiPath("/team")).toBe(false);
  });
});

describe("evaluateAccess — the middleware decision table", () => {
  const anon = { authenticated: false, role: null } as const;
  const unenrolled = { authenticated: true, role: null } as const;
  const viewer = { authenticated: true, role: "viewer" as Role };
  const operator = { authenticated: true, role: "operator" as Role };
  const admin = { authenticated: true, role: "admin" as Role };

  it("public paths are open to everyone, even unauthenticated", () => {
    expect(evaluateAccess("/api/auth/signin", anon)).toBe("allow");
    expect(evaluateAccess("/api/farcaster-manifest", anon)).toBe("allow");
  });

  it("TAP-T02: the agent relay and the pin passthrough need a session", () => {
    expect(evaluateAccess("/api/a2a", anon, "POST")).toBe("signin");
    expect(evaluateAccess("/api/ipfs", anon, "POST")).toBe("signin");
    expect(evaluateAccess("/api/a2a", viewer, "POST")).toBe("allow");
  });

  it("unauthenticated → signin everywhere else", () => {
    expect(evaluateAccess("/dashboard", anon)).toBe("signin");
    expect(evaluateAccess("/team", anon)).toBe("signin");
    expect(evaluateAccess("/api/team-proxy", anon)).toBe("signin");
    expect(evaluateAccess("/403", anon)).toBe("signin");
  });

  it("/403 renders for any authenticated session — no redirect loop for role-less users", () => {
    expect(evaluateAccess("/403", unenrolled)).toBe("allow");
    expect(evaluateAccess("/403", viewer)).toBe("allow");
  });

  it("unenrolled (role null) is forbidden on every gated path", () => {
    expect(evaluateAccess("/dashboard", unenrolled)).toBe("forbidden");
    expect(evaluateAccess("/team", unenrolled)).toBe("forbidden");
  });

  it("viewer: read-only pages yes, operator/admin surfaces no", () => {
    expect(evaluateAccess("/dashboard", viewer)).toBe("allow");
    expect(evaluateAccess("/assets/123", viewer)).toBe("allow");
    expect(evaluateAccess("/assets/new", viewer)).toBe("forbidden");
    expect(evaluateAccess("/api/media-proxy", viewer)).toBe("forbidden");
    expect(evaluateAccess("/team", viewer)).toBe("forbidden");
  });

  it("viewer: catalog reads allowed, template writes forbidden (WB-06 method scope)", () => {
    expect(evaluateAccess("/catalog", viewer)).toBe("allow");
    expect(evaluateAccess("/api/catalog-proxy/templates", viewer, "GET")).toBe("allow");
    expect(evaluateAccess("/api/catalog-proxy/templates", viewer, "POST")).toBe("forbidden");
    expect(evaluateAccess("/api/catalog-proxy/templates/tpl_1", viewer, "PUT")).toBe("forbidden");
    expect(evaluateAccess("/api/catalog-proxy/templates/tpl_1/publish", viewer, "POST")).toBe(
      "forbidden",
    );
  });

  it("operator: + drafts/media/batches/binding + template create/update, not admin verbs", () => {
    expect(evaluateAccess("/catalog", operator)).toBe("allow");
    expect(evaluateAccess("/assets/new", operator)).toBe("allow");
    expect(evaluateAccess("/api/mint-proxy", operator)).toBe("allow");
    expect(evaluateAccess("/bind", operator)).toBe("allow");
    expect(evaluateAccess("/api/catalog-proxy/templates", operator, "POST")).toBe("allow");
    expect(evaluateAccess("/api/catalog-proxy/templates/tpl_1", operator, "PUT")).toBe("allow");
    // WB-06: publish/archive/propagate are admin-level
    expect(evaluateAccess("/api/catalog-proxy/templates/tpl_1/publish", operator, "POST")).toBe(
      "forbidden",
    );
    expect(evaluateAccess("/api/catalog-proxy/templates/tpl_1/archive", operator, "POST")).toBe(
      "forbidden",
    );
    expect(evaluateAccess("/api/catalog-proxy/templates/tpl_1/propagate", operator, "POST")).toBe(
      "forbidden",
    );
    expect(evaluateAccess("/prices", operator)).toBe("forbidden");
    expect(evaluateAccess("/team", operator)).toBe("forbidden");
    expect(evaluateAccess("/api/team-proxy", operator)).toBe("forbidden");
  });

  it("admin: everything", () => {
    for (const p of [
      "/dashboard",
      "/catalog",
      "/prices",
      "/recovery",
      "/resolve",
      "/team",
      "/api/team-proxy",
      "/api/catalog-proxy/templates/tpl_1/publish",
      "/api/catalog-proxy/templates/tpl_1/archive",
      "/api/catalog-proxy/templates/tpl_1/propagate",
    ]) {
      expect(evaluateAccess(p, admin, "POST")).toBe("allow");
    }
  });
});

describe("matcher mirror (MUST stay in sync with src/middleware.ts config.matcher)", () => {
  it("gates pages and api routes", () => {
    for (const p of ["/", "/dashboard", "/team", "/api/team-proxy", "/api/auth/signin", "/403"]) {
      expect(isGatedByMatcher(p)).toBe(true);
    }
  });

  it("skips Next's build files and the public files, by name", () => {
    for (const p of [
      "/_next/static/chunks/main.js",
      "/_next/image",
      "/favicon.ico",
      "/tagit_logo.png",
    ]) {
      expect(isGatedByMatcher(p)).toBe(false);
    }
  });

  it("gates a page address even when it ends like a file", () => {
    // /assets/[id], /catalog/[id], /users/[address]… are real pages: the last
    // part of the address may end in .png and must still meet the gate.
    for (const p of [
      "/assets/x.png",
      "/catalog/x.png",
      "/users/x.svg",
      "/resolve/x.ico",
      "/governance/x.map",
      "/agents/x.txt",
      "/og-image.jpg",
      "/robots.txt",
      "/sitemap.xml",
      "/apidocs.png",
      "/logo.webp",
      "/x/tagit_logo.png",
      "/x/favicon.ico",
      "/favicon.icox",
      "/tagit_logo.png/x",
      "/_next/imagex",
      "/_next/staticx/a.js",
    ]) {
      expect(isGatedByMatcher(p), p).toBe(true);
    }
  });

  it("WB-08: nothing under /api/ is skipped, whatever it ends in", () => {
    for (const p of [
      "/api/team-proxy/foo.png",
      "/api/media-proxy/x.svg",
      "/api/catalog-proxy/templates/evil.map",
      "/api/mint-proxy/a.txt",
      "/api/tagit_logo.png",
    ]) {
      expect(isGatedByMatcher(p)).toBe(true);
    }
  });

  it("skips exactly the files that are in /public, no more and no fewer", async () => {
    const { readdirSync } = await import("node:fs");
    const path = await import("node:path");
    const files = readdirSync(path.resolve(__dirname, "../../../public"), {
      recursive: true,
      withFileTypes: true,
    })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);
    expect(files).toEqual(["tagit_logo.png"]);
    for (const name of files) expect(isGatedByMatcher(`/${name}`)).toBe(false);
  });

  it("is the same pattern the middleware file carries", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const source = readFileSync(path.resolve(__dirname, "../../middleware.ts"), "utf8");
    const literal = source.match(/matcher: \[\s*"(.+)",?\s*\]/)?.[1];
    expect(literal).toBeDefined();
    const fromFile = new RegExp(`^${JSON.parse(`"${literal}"`)}$`);
    for (const p of [
      "/",
      "/dashboard",
      "/assets/x.png",
      "/api/team-proxy/foo.png",
      "/_next/static/a.js",
      "/_next/staticx/a.js",
      "/_next/image",
      "/_next/imagex",
      "/favicon.ico",
      "/favicon.icox",
      "/tagit_logo.png",
      "/x/tagit_logo.png",
      "/robots.txt",
    ]) {
      expect(fromFile.test(p), p).toBe(isGatedByMatcher(p));
    }
  });
});

// ── TAP-T17: brand (tenant) sessions are closed out of the console ──────────

describe("evaluateAccess — a brand session reaches nothing in the console", () => {
  const brand = (role: Role | null, tenant: unknown = "biz-a") => ({
    authenticated: true,
    role,
    tenant,
  });
  const platform = (role: Role) => ({ authenticated: true, role, tenant: null });

  // What a brand session could reach before the brand app existed, the
  // staff-only pages, and addresses nobody has written yet.
  const EVERYWHERE = [
    "/",
    "/dashboard",
    "/station",
    "/verify",
    "/chip-tools",
    "/catalog",
    "/catalog/tpl_1/batch/bind",
    "/assets",
    "/assets/55",
    "/assets/new",
    "/team",
    "/agents/catalog",
    "/brands",
    "/lifecycle",
    "/assembly-line",
    "/users",
    "/governance",
    "/treasury",
    "/resolve/7",
    "/agents",
    "/test/console",
    "/some-new-page",
    "/api/dashboard-stats",
    "/api/catalog-proxy/templates",
    "/api/catalog-proxy/batches/bat_1",
    "/api/catalog-proxy/binding/bind",
    "/api/media-proxy",
    "/api/mint-proxy",
    "/api/team-proxy",
    "/api/brand-proxy",
    "/api/brand-proxy/acting",
    "/api/a2a",
    "/api/some-new-proxy",
  ];
  const METHODS = [undefined, "GET", "POST", "PUT", "DELETE"];

  it.each(EVERYWHERE)("refuses %s to a brand session of every role, on every method", (path) => {
    for (const role of [...ROLES, null]) {
      for (const method of METHODS) {
        expect(evaluateAccess(path, brand(role), method), `${role} ${method}`).toBe("forbidden");
      }
    }
  });

  it.each(EVERYWHERE)("still lets a platform admin reach %s", (path) => {
    expect(evaluateAccess(path, platform("admin"), "GET")).toBe("allow");
  });

  it("never sends a brand session anywhere but the refusal: there is no brand home here", () => {
    const decisions = new Set(
      EVERYWHERE.flatMap((path) => METHODS.map((m) => evaluateAccess(path, brand("admin"), m))),
    );
    expect([...decisions]).toEqual(["forbidden"]);
  });

  it("the 403 page still renders for a brand session (no redirect loop)", () => {
    expect(evaluateAccess("/403", brand("viewer"))).toBe("allow");
    expect(evaluateAccess("/403", brand(null))).toBe("allow");
  });

  it("the sign-in handlers stay reachable, so a brand user can sign out", () => {
    expect(evaluateAccess("/api/auth/signout", brand("admin"), "POST")).toBe("allow");
    expect(evaluateAccess("/api/auth/session", brand("admin"), "GET")).toBe("allow");
  });

  it("treats any business id as a brand, including values of the wrong type", () => {
    for (const tenant of ["biz-a", " ", "0", "null", 0, 1, true, false, {}, [], ["biz-a"]]) {
      expect(isBrandTenant(tenant), JSON.stringify(tenant)).toBe(true);
      expect(evaluateAccess("/dashboard", brand("admin", tenant)), JSON.stringify(tenant)).toBe(
        "forbidden",
      );
    }
  });

  it("treats only no business id as staff", () => {
    for (const tenant of [null, undefined, ""]) {
      expect(isBrandTenant(tenant), String(tenant)).toBe(false);
      expect(evaluateAccess("/dashboard", { authenticated: true, role: "admin", tenant })).toBe(
        "allow",
      );
    }
    // A session with no tenant field at all is a platform session.
    expect(evaluateAccess("/governance", { authenticated: true, role: "admin" })).toBe("allow");
  });

  it("a brand session with no session at all is still asked to sign in first", () => {
    expect(
      evaluateAccess("/dashboard", { authenticated: false, role: null, tenant: "biz-a" }),
    ).toBe("signin");
  });

  it("names the brand app as an https address", () => {
    expect(BRAND_APP_URL).toBe("https://pro.tagit.network");
  });
});
