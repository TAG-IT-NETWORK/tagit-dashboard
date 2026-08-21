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
    // operator — drafts + media + batches + binding
    ["/catalog", "operator"],
    ["/catalog/drafts/42", "operator"],
    ["/assets/new", "operator"],
    ["/assembly-line", "operator"],
    ["/batch", "operator"],
    ["/batch/7/execute", "operator"],
    ["/bind", "operator"],
    ["/api/media-proxy", "operator"],
    ["/api/mint-proxy", "operator"],
    // admin — publish + prices + recovery + team
    ["/catalog/publish", "admin"],
    ["/catalog/publish/42", "admin"],
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

  it("longest prefix wins: /catalog/publish escalates above /catalog", () => {
    expect(requiredRoleFor("/catalog")).toBe("operator");
    expect(requiredRoleFor("/catalog/publishing-guide")).toBe("operator"); // segment-safe
    expect(requiredRoleFor("/catalog/publish")).toBe("admin");
  });

  it("matches whole path segments only (/teammates is NOT /team)", () => {
    expect(requiredRoleFor("/teammates")).toBe("viewer");
    expect(requiredRoleFor("/bindery")).toBe("viewer");
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

  it("operator: + drafts/media/batches/binding, still not admin surfaces", () => {
    expect(evaluateAccess("/catalog", operator)).toBe("allow");
    expect(evaluateAccess("/assets/new", operator)).toBe("allow");
    expect(evaluateAccess("/api/mint-proxy", operator)).toBe("allow");
    expect(evaluateAccess("/bind", operator)).toBe("allow");
    expect(evaluateAccess("/catalog/publish", operator)).toBe("forbidden");
    expect(evaluateAccess("/prices", operator)).toBe("forbidden");
    expect(evaluateAccess("/team", operator)).toBe("forbidden");
    expect(evaluateAccess("/api/team-proxy", operator)).toBe("forbidden");
  });

  it("admin: everything", () => {
    for (const p of ["/dashboard", "/catalog", "/catalog/publish", "/prices", "/recovery", "/resolve", "/team", "/api/team-proxy"]) {
      expect(evaluateAccess(p, admin)).toBe("allow");
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
});
