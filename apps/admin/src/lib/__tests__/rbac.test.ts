// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
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

  it.each([undefined, null, "", "Admin", "superuser", 1, {}, ["admin"]])(
    "rejects %p",
    (value) => {
      expect(parseRole(value)).toBeNull();
    },
  );
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
  it("public: the auth surface and externally-authed APIs", () => {
    for (const p of [
      "/api/auth/signin",
      "/api/auth/callback/google",
      "/api/a2a",
      "/api/farcaster-manifest",
      "/api/ipfs",
    ]) {
      expect(isPublicPath(p)).toBe(true);
    }
  });

  it("NOT public: pages and the key-holding proxies", () => {
    for (const p of ["/dashboard", "/team", "/api/media-proxy", "/api/mint-proxy", "/api/team-proxy"]) {
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
    expect(evaluateAccess("/api/a2a", anon)).toBe("allow");
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

  it("skips Next internals and static assets", () => {
    for (const p of [
      "/_next/static/chunks/main.js",
      "/_next/image?url=x",
      "/favicon.ico",
      "/tagit_logo.png",
      "/og-image.jpg",
      "/robots.txt",
      "/sitemap.xml",
    ]) {
      expect(isGatedByMatcher(p)).toBe(false);
    }
  });

  it("WB-08: the extension exclusion does NOT apply under /api/ — no gate bypass", () => {
    for (const p of [
      "/api/team-proxy/foo.png",
      "/api/media-proxy/x.svg",
      "/api/catalog-proxy/templates/evil.map",
      "/api/mint-proxy/a.txt",
    ]) {
      expect(isGatedByMatcher(p)).toBe(true);
    }
    // Non-/api static assets stay excluded.
    expect(isGatedByMatcher("/apidocs.png")).toBe(false);
    expect(isGatedByMatcher("/logo.webp")).toBe(false);
  });
});
