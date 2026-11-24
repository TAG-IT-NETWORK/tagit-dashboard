import { NextRequest, type NextFetchEvent } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The gate as a whole (TAP-T17): the real middleware, with the sign-in
 * library replaced by a stand-in that attaches whatever session the test
 * names and counts how often the session was read.
 */
const state: { session: unknown; reads: number } = { session: null, reads: 0 };

vi.mock("@/auth", () => ({
  auth: (handler: (req: NextRequest & { auth: unknown }) => Response) => (req: NextRequest) => {
    state.reads += 1;
    return handler(Object.assign(req, { auth: state.session }));
  },
}));

const brandUser = { user: { email: "jane@acme.com", role: "viewer", businessId: "acme" } };
const staffUser = { user: { email: "staff@tagit.test", role: "admin", businessId: null } };
const goneUser = { user: { email: "gone@acme.com", role: null, businessId: null } };

async function hit(path: string, method = "GET"): Promise<Response> {
  const { default: middleware } = await import("@/middleware");
  const req = new NextRequest(new URL(path, "https://pro.test"), { method });
  return (await middleware(req, {} as NextFetchEvent)) as Response;
}
const passed = (res: Response) => res.headers.get("x-middleware-next") === "1";
const to = (res: Response) => {
  const location = res.headers.get("location");
  return location ? new URL(location).pathname + new URL(location).search : null;
};

beforeEach(() => {
  state.session = null;
  state.reads = 0;
  vi.stubEnv("AUTH_SECRET", "s");
  vi.stubEnv("AUTH_GOOGLE_ID", "i");
  vi.stubEnv("AUTH_GOOGLE_SECRET", "g");
});
afterEach(() => vi.unstubAllEnvs());

describe("open paths", () => {
  it("pass without the session ever being read", async () => {
    for (const path of ["/api/auth/session", "/api/demo-request", "/no-access"]) {
      expect(passed(await hit(path)), path).toBe(true);
    }
    expect(state.reads).toBe(0);
  });
});

describe("a visitor with no session", () => {
  it("sees the landing and sign-in pages", async () => {
    expect(passed(await hit("/"))).toBe(true);
    expect(passed(await hit("/signin"))).toBe(true);
  });

  it("is sent to sign in from any page, with the way back remembered", async () => {
    const res = await hit("/home/items?tab=sold");
    expect(res.status).toBe(307);
    expect(to(res)).toBe("/signin?callbackUrl=%2Fhome%2Fitems%3Ftab%3Dsold");
    for (const path of ["/dashboard", "/products", "/settings"]) {
      expect(to(await hit(path))?.startsWith("/signin?callbackUrl="), path).toBe(true);
    }
  });

  it("gets 401 from any API address, with no detail", async () => {
    for (const path of ["/api/brand/me", "/api/bind", "/api/x.png"]) {
      const res = await hit(path, "POST");
      expect(res.status, path).toBe(401);
      await expect(res.json()).resolves.toEqual({ ok: false, error: "UNAUTHENTICATED" });
    }
  });
});

describe("a brand session", () => {
  beforeEach(() => {
    state.session = brandUser;
  });

  it("reaches the app", async () => {
    expect(passed(await hit("/home"))).toBe(true);
  });

  it("is sent home from the landing page, the sign-in page and any page not listed", async () => {
    for (const path of ["/", "/signin", "/dashboard", "/products/7", "/mesh"]) {
      const res = await hit(path);
      expect(res.status, path).toBe(307);
      expect(to(res), path).toBe("/home");
    }
  });

  it("gets 403 from an API address that is not listed", async () => {
    const res = await hit("/api/bind", "POST");
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ ok: false, error: "FORBIDDEN" });
  });
});

describe("a session that is not a brand session", () => {
  it("is sent to the no-access page, staff and removed users alike", async () => {
    for (const session of [staffUser, goneUser, { user: {} }, {}]) {
      state.session = session;
      const res = await hit("/home");
      expect(res.status).toBe(307);
      expect(to(res)).toBe("/no-access");
      const api = await hit("/api/brand/me");
      expect(api.status).toBe(403);
      await expect(api.json()).resolves.toEqual({ ok: false, error: "FORBIDDEN" });
    }
  });

  it("can still see the landing page", async () => {
    state.session = staffUser;
    expect(passed(await hit("/"))).toBe(true);
  });
});

describe("when sign-in is not configured", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_SECRET", "");
    state.session = brandUser; // even a session that looks valid counts for nothing
  });

  it("keeps the public pages up without reading the session", async () => {
    for (const path of ["/", "/signin", "/no-access", "/api/demo-request"]) {
      expect(passed(await hit(path)), path).toBe(true);
    }
    expect(state.reads).toBe(0);
  });

  it("closes everything else", async () => {
    for (const path of ["/home", "/dashboard", "/products"]) {
      const res = await hit(path);
      expect(res.status, path).toBe(307);
      expect(to(res), path).toBe("/");
    }
    const api = await hit("/api/brand/me");
    expect(api.status).toBe(503);
    await expect(api.json()).resolves.toEqual({ ok: false, error: "SIGN_IN_NOT_CONFIGURED" });
    expect(state.reads).toBe(0);
  });
});
