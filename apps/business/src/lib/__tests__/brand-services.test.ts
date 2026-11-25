import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BrandServicesError,
  brandFetch,
  getBrandProfile,
  isServicesPath,
} from "@/lib/brand-services";
import { toBrandSession, type BrandSession } from "@/lib/brand-session";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const session = toBrandSession({ email: "jane@acme.com", role: "operator", businessId: "acme" })!;
const fetchMock = vi.fn();
const answer = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

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

describe("isServicesPath", () => {
  it("accepts plain /api/v1/ paths", () => {
    expect(isServicesPath("/api/v1/admin/businesses/acme")).toBe(true);
    expect(isServicesPath("/api/v1/admin/templates?limit=5&x=a%20b")).toBe(true);
  });
  it("refuses anything that could leave that space", () => {
    for (const bad of [
      "/api/v2/x",
      "/api/v1",
      "api/v1/x",
      "https://evil.example/api/v1/x",
      "//evil.example/api/v1/x",
      "/api/v1/../../health",
      "/api/v1/a//b",
      "/api/v1/a\\b",
      "/api/v1/x@evil.example",
      "/api/v1/x#frag",
      "/api/v1/a b",
      "/api/v1/a\nb",
      `/api/v1/${"x".repeat(1000)}`,
      "",
      null,
      undefined,
      7,
    ]) {
      expect(isServicesPath(bad), String(bad)).toBe(false);
    }
  });
});

describe("brandFetch", () => {
  it("always calls under the session's brand, as the session's person, with the key", async () => {
    fetchMock.mockReturnValue(answer(200, { ok: true }));
    await expect(brandFetch(session, "/api/v1/admin/templates")).resolves.toEqual({
      status: 200,
      body: { ok: true },
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://services.test/api/v1/admin/templates");
    expect(init.headers).toEqual({
      authorization: "Bearer test-key",
      "x-business-id": "acme",
      "x-actor": "jane@acme.com",
    });
    expect(init.method).toBe("GET");
    expect(init.cache).toBe("no-store");
    expect(init.redirect).toBe("error");
    expect(init.body).toBeUndefined();
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("gives the caller no way to pass headers", async () => {
    fetchMock.mockReturnValue(answer(200, { ok: true }));
    const sneaky = {
      method: "GET",
      headers: { "x-business-id": "other", authorization: "Bearer theirs", "x-actor": "boss" },
    } as unknown as Parameters<typeof brandFetch>[2];
    await brandFetch(session, "/api/v1/admin/templates", sneaky);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toEqual({
      authorization: "Bearer test-key",
      "x-business-id": "acme",
      "x-actor": "jane@acme.com",
    });
  });

  it("sends a body as JSON", async () => {
    fetchMock.mockReturnValue(answer(200, { ok: true }));
    await brandFetch(session, "/api/v1/admin/x", { method: "PUT", body: { price: 5 } });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("PUT");
    expect(init.body).toBe('{"price":5}');
    expect((init.headers as Record<string, string>)["content-type"]).toBe("application/json");
    expect((init.headers as Record<string, string>)["x-business-id"]).toBe("acme");
  });

  it("refuses, without calling out, when there is no brand on the session", async () => {
    for (const bad of [
      null,
      undefined,
      {},
      { email: "jane@acme.com", role: "admin", brandId: "" },
      { email: "jane@acme.com", role: "admin", brandId: null },
      { email: "jane@acme.com", role: "admin" },
    ]) {
      await expect(
        brandFetch(bad as unknown as BrandSession, "/api/v1/admin/templates"),
      ).rejects.toMatchObject({ code: "NO_BRAND" });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses, without calling out, a path outside /api/v1/", async () => {
    for (const bad of [
      "/health",
      "https://evil.example/api/v1/x",
      "/api/v1/../x",
      "/api/v1/a//b",
    ]) {
      await expect(brandFetch(session, bad)).rejects.toMatchObject({ code: "BAD_PATH" });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses, without calling out, when the key is not set", async () => {
    vi.stubEnv("SERVICES_API_KEY", "");
    await expect(brandFetch(session, "/api/v1/admin/templates")).rejects.toBeInstanceOf(
      BrandServicesError,
    );
    await expect(brandFetch(session, "/api/v1/admin/templates")).rejects.toMatchObject({
      code: "NOT_CONFIGURED",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never puts the key in an error", async () => {
    vi.stubEnv("SERVICES_API_KEY", "");
    const error = await brandFetch(session, "/api/v1/x").catch((e: unknown) => e);
    expect(JSON.stringify(error) + String(error)).not.toContain("test-key");
    vi.stubEnv("SERVICES_API_KEY", "test-key");
    const bad = await brandFetch(session, "/nope").catch((e: unknown) => e);
    expect(JSON.stringify(bad) + String(bad)).not.toContain("test-key");
  });

  it("returns a null body for an answer that is not JSON", async () => {
    fetchMock.mockReturnValue(Promise.resolve(new Response("<html>", { status: 502 })));
    await expect(brandFetch(session, "/api/v1/x")).resolves.toEqual({ status: 502, body: null });
  });
});

describe("getBrandProfile", () => {
  it("asks for the session's own brand record and nothing else", async () => {
    fetchMock.mockReturnValue(
      answer(200, { ok: true, business: { id: "acme", name: "Acme", logoUrl: null } }),
    );
    await expect(getBrandProfile(session)).resolves.toEqual({ name: "Acme", logoUrl: null });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://services.test/api/v1/admin/businesses/acme");
    expect((init.headers as Record<string, string>)["x-business-id"]).toBe("acme");
  });

  it("still gives a name when services is down or the key is missing", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network"));
    await expect(getBrandProfile(session)).resolves.toEqual({ name: "acme", logoUrl: null });
    vi.stubEnv("SERVICES_API_KEY", "");
    await expect(getBrandProfile(session)).resolves.toEqual({ name: "acme", logoUrl: null });
  });

  it("escapes a brand id that carries path characters", async () => {
    const odd = toBrandSession({ email: "j@a.co", role: "viewer", businessId: "a/b?c" })!;
    fetchMock.mockReturnValue(answer(404, { ok: false }));
    await expect(getBrandProfile(odd)).resolves.toEqual({ name: "a/b?c", logoUrl: null });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://services.test/api/v1/admin/businesses/a%2Fb%3Fc");
    expect((init.headers as Record<string, string>)["x-business-id"]).toBe("a/b?c");
  });
});
