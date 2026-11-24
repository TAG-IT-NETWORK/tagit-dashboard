import { describe, expect, it } from "vitest";

import {
  BRAND_HOME,
  evaluateAccess,
  evaluateWithoutAuth,
  hasRole,
  isBrandSession,
  isGatedByMatcher,
  isOpenPath,
  parseBrandId,
  parseRole,
  requiredRoleFor,
  safeCallbackPath,
  type AccessSession,
} from "@/lib/access";

const nobody: AccessSession = { authenticated: false, role: null, brand: null };
const brand: AccessSession = { authenticated: true, role: "viewer", brand: "acme" };
const staff: AccessSession = { authenticated: true, role: "admin", brand: null };
const unknown: AccessSession = { authenticated: true, role: null, brand: null };
const removed: AccessSession = { authenticated: true, role: null, brand: "acme" };

describe("parseRole / hasRole / parseBrandId", () => {
  it("accepts only the three roles", () => {
    expect(parseRole("viewer")).toBe("viewer");
    expect(parseRole("operator")).toBe("operator");
    expect(parseRole("admin")).toBe("admin");
    for (const bad of ["owner", "Admin", "", null, undefined, 1, {}]) {
      expect(parseRole(bad)).toBeNull();
    }
  });

  it("ranks viewer < operator < admin and refuses a missing role", () => {
    expect(hasRole("admin", "operator")).toBe(true);
    expect(hasRole("operator", "operator")).toBe(true);
    expect(hasRole("viewer", "operator")).toBe(false);
    expect(hasRole(null, "viewer")).toBe(false);
  });

  it("takes a brand id only from a non-empty string of sane length", () => {
    expect(parseBrandId("acme")).toBe("acme");
    expect(parseBrandId("x".repeat(200))).toBe("x".repeat(200));
    for (const bad of ["", "x".repeat(201), null, undefined, 7, ["acme"], { id: "acme" }]) {
      expect(parseBrandId(bad)).toBeNull();
    }
  });
});

describe("isBrandSession", () => {
  it("needs a session, a role and a brand, all three", () => {
    expect(isBrandSession(brand)).toBe(true);
    expect(isBrandSession(staff)).toBe(false);
    expect(isBrandSession(unknown)).toBe(false);
    expect(isBrandSession(removed)).toBe(false);
    expect(isBrandSession({ authenticated: false, role: "admin", brand: "acme" })).toBe(false);
    expect(isBrandSession({ authenticated: true, role: "admin", brand: "" })).toBe(false);
  });
});

describe("evaluateAccess", () => {
  it("lets anyone reach the open paths, whoever they are", () => {
    for (const path of [
      "/api/auth/signin",
      "/api/auth/callback/google",
      "/api/demo-request",
      "/no-access",
    ]) {
      for (const who of [nobody, brand, staff, unknown, removed]) {
        expect(evaluateAccess(path, who), path).toBe("allow");
      }
    }
  });

  it("does not open look-alike paths", () => {
    expect(isOpenPath("/api/authx")).toBe(false);
    expect(isOpenPath("/api/demo-requests")).toBe(false);
    expect(isOpenPath("/no-accessible")).toBe(false);
    expect(evaluateAccess("/api/authx", nobody)).toBe("signin");
    expect(evaluateAccess("/api/demo-requests", nobody)).toBe("signin");
  });

  it("shows the landing and sign-in pages to everyone but a brand session, who goes home", () => {
    for (const path of ["/", "/signin"]) {
      expect(evaluateAccess(path, nobody)).toBe("allow");
      expect(evaluateAccess(path, staff)).toBe("allow");
      expect(evaluateAccess(path, unknown)).toBe("allow");
      expect(evaluateAccess(path, brand)).toBe("home");
    }
  });

  it("sends a visitor with no session to sign in, for every other path", () => {
    for (const path of ["/home", "/home/x", "/dashboard", "/products", "/api/brand", "/x"]) {
      expect(evaluateAccess(path, nobody), path).toBe("signin");
    }
  });

  it("gives staff, unknown and removed accounts the same answer everywhere inside", () => {
    for (const path of ["/home", "/home/x", "/dashboard", "/api/anything", "/whatever"]) {
      for (const who of [staff, unknown, removed]) {
        expect(evaluateAccess(path, who), path).toBe("no-access");
      }
    }
  });

  it("lets a brand session into the app", () => {
    expect(evaluateAccess("/home", brand)).toBe("allow");
    expect(evaluateAccess("/home/anything", brand)).toBe("allow");
  });

  it("keeps a brand session out of every path that is not listed", () => {
    // The old wallet prototype screens are still in the code; none is listed.
    for (const path of [
      "/dashboard",
      "/products",
      "/products/7",
      "/agents",
      "/mesh",
      "/metrics",
      "/lifecycle",
      "/provenance",
      "/settings",
      "/homes",
      "/home-admin",
    ]) {
      expect(evaluateAccess(path, brand), path).toBe("home");
    }
    for (const path of ["/api/bind", "/api/brand", "/api/home", "/api"]) {
      expect(evaluateAccess(path, brand), path).toBe("forbidden");
    }
  });

  it("defaults a brand path to viewer", () => {
    expect(requiredRoleFor("/home")).toBe("viewer");
    expect(requiredRoleFor("/home", "POST")).toBe("viewer");
  });
});

describe("evaluateWithoutAuth", () => {
  it("keeps the public pages up and closes everything else", () => {
    for (const path of ["/", "/signin", "/no-access", "/api/demo-request", "/api/auth/session"]) {
      expect(evaluateWithoutAuth(path), path).toBe("allow");
    }
    for (const path of ["/home", "/dashboard", "/products", "/api/x", "/anything"]) {
      expect(evaluateWithoutAuth(path), path).toBe("closed");
    }
  });
});

describe("safeCallbackPath", () => {
  it("keeps a path inside the app, with its query", () => {
    expect(safeCallbackPath("/home")).toBe("/home");
    expect(safeCallbackPath("/home/items?tab=sold")).toBe("/home/items?tab=sold");
  });

  it("turns everything else into the brand home", () => {
    const bad: unknown[] = [
      undefined,
      null,
      "",
      7,
      ["/home"],
      "https://evil.example/home",
      "//evil.example/home",
      "/\\evil.example",
      "/home\\..\\x",
      "/home/\\evil.example",
      "javascript:alert(1)",
      "home",
      "/",
      "/signin",
      "/dashboard",
      "/api/auth/signout",
      "/homes",
      "/home\n/x",
      "/home /x",
      "/home\t",
      `/home/${"x".repeat(600)}`,
    ];
    for (const value of bad) expect(safeCallbackPath(value), String(value)).toBe(BRAND_HOME);
  });
});

describe("the matcher mirror", () => {
  it("gates pages and every API address", () => {
    for (const path of ["/", "/home", "/signin", "/api/x", "/api/x.png", "/api/a/b.svg"]) {
      expect(isGatedByMatcher(path), path).toBe(true);
    }
  });

  it("gates a page address even when it ends like a file", () => {
    // /products/[id] and /agents/[id] are real pages: an id may end in .png.
    for (const path of [
      "/products/anything.png",
      "/agents/anything.svg",
      "/home/x.ico",
      "/dashboard.txt",
      "/a.map",
      "/x/tagit_logo.png",
      "/x/favicon.ico",
      "/favicon.icox",
      "/tagit_logo.png/x",
      "/_next/imagex",
      "/_next/staticx/a.js",
      "/_next/data/x.json",
    ]) {
      expect(isGatedByMatcher(path), path).toBe(true);
    }
  });

  it("skips Next's build files and the public files, by name", () => {
    for (const path of ["/_next/static/chunks/a.js", "/_next/image", "/favicon.ico"]) {
      expect(isGatedByMatcher(path), path).toBe(false);
    }
  });

  it("skips exactly the files that are in /public, no more and no fewer", async () => {
    const { readdirSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const dir = fileURLToPath(new URL("../../../public", import.meta.url));
    const files = readdirSync(dir, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);
    expect(files).toEqual(["tagit_logo.png"]);
    for (const name of files) expect(isGatedByMatcher(`/${name}`), name).toBe(false);
  });

  it("is the same pattern the middleware file carries", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const source = readFileSync(
      fileURLToPath(new URL("../../middleware.ts", import.meta.url)),
      "utf8",
    );
    const literal = source.match(/matcher: \[\s*"(.+)",?\s*\]/)?.[1];
    expect(literal).toBeDefined();
    const fromFile = new RegExp(`^${JSON.parse(`"${literal}"`)}$`);
    for (const path of [
      "/",
      "/home",
      "/api/x.png",
      "/products/anything.png",
      "/agents/anything.svg",
      "/_next/static/a.js",
      "/_next/staticx/a.js",
      "/_next/image",
      "/_next/imagex",
      "/favicon.ico",
      "/favicon.icox",
      "/tagit_logo.png",
      "/x/tagit_logo.png",
      "/a.map",
      "/api/auth/session",
    ]) {
      expect(fromFile.test(path), path).toBe(isGatedByMatcher(path));
    }
  });
});
