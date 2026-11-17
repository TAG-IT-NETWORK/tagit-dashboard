import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The limiter, replaced by one the test can watch. A tap route must never
// reach it.
const limiter = vi.hoisted(() => ({
  hit: vi.fn(),
}));
vi.mock("../rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../rate-limit")>()),
  createRateLimitStore: () => ({ hit: limiter.hit }),
}));

import { config, middleware } from "../../middleware";
import { isCacheableReadPath, isRateLimitedPath, isTapPath } from "../cache";
import {
  TAP_DEVICE_HEADER,
  TAP_DEVICE_MAX_AGE_SECONDS,
  isTapDeviceId,
  newTapDeviceId,
} from "../tap-device-cookie";

/**
 * TAP-T10: the middleware gives the four tap routes the device id that lets a
 * phone reopen its own check, and does nothing else to them: no limiter, no
 * cache header. Everything it already did for the other routes is unchanged.
 */

const TAP = "picc=00112233445566778899AABBCCDDEEFF&cmac=0011223344556677";
const TAP_URLS = [
  `/sun?${TAP}`,
  `/01/09506000134352/21/SN-1?${TAP}`,
  `/01/09506000134352?${TAP}`,
  `/api/verify?${TAP}`,
  `/api/dpp/01/09506000134352/21/SN-1?${TAP}`,
  `/api/dpp/token/58?${TAP}`,
];

function request(
  path: string,
  init: {
    cookie?: string;
    headers?: Record<string, string>;
    origin?: string;
    method?: string;
  } = {},
) {
  const origin = init.origin ?? "https://verify.tagit.network";
  return new NextRequest(`${origin}${path}`, {
    method: init.method ?? "GET",
    headers: {
      ...(init.cookie ? { cookie: init.cookie } : {}),
      ...init.headers,
    },
  });
}

/** The header the middleware hands on to the route (Next carries it on the response). */
const handedOn = (res: Response) => res.headers.get(`x-middleware-request-${TAP_DEVICE_HEADER}`);

beforeEach(() => {
  limiter.hit.mockReset().mockResolvedValue({ allowed: true, remaining: 59, resetSeconds: 60 });
});

describe("which paths are tap routes", () => {
  it.each([
    "/sun",
    "/sun/",
    "/01/09506000134352",
    "/01/09506000134352/21/SN-1",
    "/api/verify",
    "/api/verify/",
    "/api/dpp/01/09506000134352/21/SN-1",
    "/api/dpp/token/58",
  ])("%s is one", (path) => {
    expect(isTapPath(path)).toBe(true);
    // …and a tap route is never a cached or rate-limited one
    expect(isRateLimitedPath(path)).toBe(false);
    expect(isCacheableReadPath(path)).toBe(false);
  });

  it.each([
    "/",
    "/asset/58",
    "/api/asset/58",
    "/api/asset/58/provenance",
    "/mcp",
    "/sunny",
    "/sun/more",
    "/010",
    "/api/verifyx",
    "/api/verify/more",
    "/api/dppx",
    "/tag/04A1B2C3D4E5F6",
    "/api/buy",
    "/api/warm",
  ])("%s is not", (path) => {
    expect(isTapPath(path)).toBe(false);
  });

  it("the middleware is switched on for all four, and still for the routes it already covered", () => {
    expect(config.matcher).toEqual([
      "/asset/:path*",
      "/api/asset/:path*",
      "/mcp",
      "/sun",
      "/01/:path*",
      "/api/verify",
      "/api/dpp/:path*",
    ]);
  });
});

describe("a tap route: the first request from a phone", () => {
  it.each(TAP_URLS)("%s gets a new id, as a cookie and handed on to the route", async (path) => {
    const res = await middleware(request(path));

    const cookie = res.cookies.get("__Host-tap-device");
    expect(cookie).toBeDefined();
    expect(isTapDeviceId(cookie!.value)).toBe(true);
    expect(handedOn(res)).toBe(cookie!.value);
  });

  it("the cookie cannot be read by scripts, goes only over https, and lasts 15 minutes", async () => {
    const res = await middleware(request(`/sun?${TAP}`));

    expect(res.cookies.get("__Host-tap-device")).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: TAP_DEVICE_MAX_AGE_SECONDS,
    });
    const raw = res.headers.get("set-cookie") ?? "";
    expect(raw).toMatch(/^__Host-tap-device=[A-Za-z0-9_-]{22};/);
    expect(raw).toMatch(/HttpOnly/i);
    expect(raw).toMatch(/Secure/i);
    expect(raw).toMatch(/SameSite=lax/i);
    expect(raw).toMatch(/Max-Age=900/i);
    expect(raw).not.toMatch(/Domain=/i);
  });

  it("two phones get two different ids", async () => {
    const one = await middleware(request(`/sun?${TAP}`));
    const other = await middleware(request(`/sun?${TAP}`));
    expect(handedOn(one)).not.toBe(handedOn(other));
  });

  it("on a developer machine (plain http) the cookie is plainly named and not marked secure", async () => {
    const res = await middleware(request(`/sun?${TAP}`, { origin: "http://localhost:3004" }));

    expect(res.cookies.get("__Host-tap-device")).toBeUndefined();
    expect(res.cookies.get("tap-device")).toMatchObject({ httpOnly: true, secure: false });
    expect(handedOn(res)).toBe(res.cookies.get("tap-device")!.value);
  });
});

describe("a tap route: the same phone coming back", () => {
  it("keeps its id, hands it on, and renews the cookie", async () => {
    const id = newTapDeviceId();

    const res = await middleware(request(`/sun?${TAP}`, { cookie: `__Host-tap-device=${id}` }));

    expect(handedOn(res)).toBe(id);
    expect(res.cookies.get("__Host-tap-device")).toMatchObject({
      value: id,
      maxAge: TAP_DEVICE_MAX_AGE_SECONDS,
    });
  });

  it("is the same phone on every tap route", async () => {
    const id = newTapDeviceId();
    for (const path of TAP_URLS) {
      const res = await middleware(request(path, { cookie: `__Host-tap-device=${id}` }));
      expect(handedOn(res), path).toBe(id);
    }
  });

  it.each([
    ["empty", ""],
    ["too short", "abc"],
    ["not an id", "x".repeat(21) + "!"],
    ["far too long", "A".repeat(4000)],
  ])("a cookie that is %s is replaced by a new id", async (_name, value) => {
    const res = await middleware(
      request(`/sun?${TAP}`, { cookie: `__Host-tap-device=${encodeURIComponent(value)}` }),
    );

    const id = handedOn(res);
    expect(isTapDeviceId(id)).toBe(true);
    expect(id).not.toBe(value);
    expect(res.cookies.get("__Host-tap-device")!.value).toBe(id);
  });

  it("does not take the plainly named cookie over https", async () => {
    const planted = newTapDeviceId();
    const res = await middleware(request(`/sun?${TAP}`, { cookie: `tap-device=${planted}` }));
    expect(handedOn(res)).not.toBe(planted);
  });
});

describe("a tap route: what a client cannot do", () => {
  it("cannot choose its id by sending the header the route reads", async () => {
    const chosen = newTapDeviceId();

    const res = await middleware(
      request(`/sun?${TAP}`, { headers: { [TAP_DEVICE_HEADER]: chosen } }),
    );

    expect(handedOn(res)).not.toBe(chosen);
    expect(isTapDeviceId(handedOn(res))).toBe(true);
  });

  it("when it has a cookie, the cookie wins over the header", async () => {
    const held = newTapDeviceId();
    const chosen = newTapDeviceId();

    const res = await middleware(
      request(`/sun?${TAP}`, {
        cookie: `__Host-tap-device=${held}`,
        headers: { [TAP_DEVICE_HEADER]: chosen },
      }),
    );

    expect(handedOn(res)).toBe(held);
  });
});

describe("a tap route: a HEAD request", () => {
  // HEAD asks for no page. Running the route would still open the link, and
  // the person who follows it afterwards would be told it had expired.
  it.each(TAP_URLS)("%s is answered at once and never reaches the route", async (path) => {
    const res = await middleware(request(path, { method: "HEAD" }));

    expect(res.status).toBe(200);
    // Not passed on: nothing was handed to a route, and no rewrite or "next".
    expect(res.headers.get("x-middleware-next")).toBeNull();
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    expect(handedOn(res)).toBeNull();
    expect(await res.text()).toBe("");
  });

  it("may not be stored, sets no cookie and is not rate-limited", async () => {
    const res = await middleware(request(`/sun?${TAP}`, { method: "HEAD" }));

    expect(res.headers.get("cache-control")).toBe("no-store, no-cache, must-revalidate");
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(limiter.hit).not.toHaveBeenCalled();
  });

  it("a GET of the same address does reach the route", async () => {
    const res = await middleware(request(`/sun?${TAP}`));
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("a HEAD of a route that is not a tap route is handled as before", async () => {
    const res = await middleware(request("/asset/58", { method: "HEAD" }));
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(limiter.hit).toHaveBeenCalledTimes(1);
  });
});

describe("a tap route is never rate-limited and never given a cache header", () => {
  it.each(TAP_URLS)("%s", async (path) => {
    const res = await middleware(request(path));

    expect(limiter.hit).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBeNull();
    expect(res.headers.get("x-ratelimit-limit")).toBeNull();
    expect(res.headers.get("retry-after")).toBeNull();
  });

  it("not even when the limiter would say no", async () => {
    limiter.hit.mockResolvedValue({ allowed: false, remaining: 0, resetSeconds: 30 });

    for (let i = 0; i < 50; i += 1) {
      const res = await middleware(request(`/sun?${TAP}`));
      expect(res.status).toBe(200);
    }
    expect(limiter.hit).not.toHaveBeenCalled();
  });
});

describe("the routes the middleware already covered are unchanged", () => {
  it.each(["/asset/58", "/api/asset/58", "/api/asset/58/provenance", "/mcp"])(
    "%s is still rate-limited, and gets no device id",
    async (path) => {
      const res = await middleware(request(path));

      expect(limiter.hit).toHaveBeenCalledTimes(1);
      expect(res.headers.get("x-ratelimit-limit")).not.toBeNull();
      expect(res.headers.get("set-cookie")).toBeNull();
      expect(handedOn(res)).toBeNull();
    },
  );

  it("still answers 429 there when the limit is reached", async () => {
    limiter.hit.mockResolvedValue({ allowed: false, remaining: 0, resetSeconds: 30 });

    const res = await middleware(request("/asset/58"));

    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});
