import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BrandServicesError,
  brandFetch,
  createBrandProduct,
  getBrandProduct,
  getBrandProducts,
  getBrandProfile,
  publishBrandProduct,
  updateBrandProduct,
  uploadBrandPhoto,
  getBrandSummary,
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
    await expect(getBrandProfile(session)).resolves.toEqual({
      name: "Acme",
      nameKnown: true,
      logoUrl: null,
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://services.test/api/v1/admin/businesses/acme");
    expect((init.headers as Record<string, string>)["x-business-id"]).toBe("acme");
  });

  it("still gives a name when services is down or the key is missing", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network"));
    await expect(getBrandProfile(session)).resolves.toEqual({
      name: "acme",
      nameKnown: false,
      logoUrl: null,
    });
    vi.stubEnv("SERVICES_API_KEY", "");
    await expect(getBrandProfile(session)).resolves.toEqual({
      name: "acme",
      nameKnown: false,
      logoUrl: null,
    });
  });

  it("escapes a brand id that carries path characters", async () => {
    const odd = toBrandSession({ email: "j@a.co", role: "viewer", businessId: "a/b?c" })!;
    fetchMock.mockReturnValue(answer(404, { ok: false }));
    await expect(getBrandProfile(odd)).resolves.toEqual({
      name: "a/b?c",
      nameKnown: false,
      logoUrl: null,
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://services.test/api/v1/admin/businesses/a%2Fb%3Fc");
    expect((init.headers as Record<string, string>)["x-business-id"]).toBe("a/b?c");
  });
});

describe("getBrandProducts and getBrandSummary", () => {
  const product = {
    id: "tpl_1",
    name: "Cream",
    status: "published",
    priceUsdc6: "5000000",
    businessId: "acme",
    itemsCount: 2,
  };
  const counts = { items: 4, forSale: 1, byState: { CLAIMED: 2, FLAGGED: 0 } };

  it("ask the two listed routes, under the session's brand, with GET and no body", async () => {
    fetchMock.mockReturnValueOnce(answer(200, { ok: true, templates: [product] }));
    fetchMock.mockReturnValueOnce(answer(200, { ok: true, summary: counts }));
    const list = await getBrandProducts(session);
    const summary = await getBrandSummary(session);
    expect(list.products.map((p) => p.id)).toEqual(["tpl_1"]);
    expect(summary).toEqual({ items: 4, forSale: 1, withCustomers: 2, flagged: 0 });

    const calls = fetchMock.mock.calls as Array<[string, RequestInit]>;
    expect(calls.map(([url]) => url)).toEqual([
      "https://services.test/api/v1/admin/templates",
      "https://services.test/api/v1/admin/catalog/summary",
    ]);
    for (const [, init] of calls) {
      expect(init.method).toBe("GET");
      expect(init.body).toBeUndefined();
      expect((init.headers as Record<string, string>)["x-business-id"]).toBe("acme");
    }
  });

  it("never show another brand's product, even if services sent one", async () => {
    fetchMock.mockReturnValue(
      answer(200, {
        ok: true,
        templates: [{ ...product, id: "theirs", businessId: "other" }, product],
      }),
    );
    expect((await getBrandProducts(session)).products.map((p) => p.id)).toEqual(["tpl_1"]);
  });

  it("say they could not load when services refuses, is down, or has no key", async () => {
    // A refusal is a refusal even when its body looks like a good answer.
    fetchMock.mockReturnValueOnce(answer(403, { ok: true, templates: [product] }));
    expect(await getBrandProducts(session)).toEqual({ loaded: false, products: [] });
    fetchMock.mockReturnValueOnce(answer(403, { ok: true, summary: counts }));
    expect(await getBrandSummary(session)).toBeNull();
    fetchMock.mockRejectedValue(new Error("network"));
    expect(await getBrandProducts(session)).toEqual({ loaded: false, products: [] });
    expect(await getBrandSummary(session)).toBeNull();
    vi.stubEnv("SERVICES_API_KEY", "");
    expect(await getBrandProducts(session)).toEqual({ loaded: false, products: [] });
    expect(await getBrandSummary(session)).toBeNull();
  });
});

describe("product editing calls", () => {
  const SHA = "c".repeat(64);
  const PHOTO = `https://media.tagit.network/i/${SHA}/lg.webp`;
  const body = {
    name: "Cream",
    brand: "Acme",
    model: null,
    sku: null,
    category: null,
    origin: null,
    description: null,
    priceUsdc6: null,
  };
  const template = {
    id: "tpl_1",
    businessId: "acme",
    status: "draft",
    version: 0,
    name: "Cream",
    attributes: [],
  };
  const last = () => fetchMock.mock.calls.at(-1) as [string, RequestInit];
  const headersOf = (init: RequestInit) => init.headers as Record<string, string>;

  it("each go to one listed route, under the session's brand and user", async () => {
    fetchMock.mockReturnValueOnce(answer(200, { ok: true, template }));
    expect((await getBrandProduct(session, "tpl_1"))?.id).toBe("tpl_1");
    expect(last()[0]).toBe("https://services.test/api/v1/admin/templates/tpl_1");
    expect(last()[1].method).toBe("GET");

    fetchMock.mockReturnValueOnce(answer(201, { ok: true, template }));
    expect(await createBrandProduct(session, body)).toBe("tpl_1");
    expect(last()[0]).toBe("https://services.test/api/v1/admin/templates");
    expect(last()[1].method).toBe("POST");
    expect(JSON.parse(last()[1].body as string)).toEqual(body);

    fetchMock.mockReturnValueOnce(answer(200, { ok: true, template }));
    expect(await updateBrandProduct(session, "tpl_1", body)).toBe(true);
    expect(last()[0]).toBe("https://services.test/api/v1/admin/templates/tpl_1");
    expect(last()[1].method).toBe("PUT");

    fetchMock.mockReturnValueOnce(answer(201, { ok: true }));
    expect(await publishBrandProduct(session, "tpl_1")).toBe(true);
    expect(last()[0]).toBe("https://services.test/api/v1/admin/templates/tpl_1/publish");
    expect(last()[1].method).toBe("POST");

    for (const [, init] of fetchMock.mock.calls as Array<[string, RequestInit]>) {
      expect(headersOf(init)["x-business-id"]).toBe("acme");
      expect(headersOf(init)["x-actor"]).toBe("jane@acme.com");
      expect(headersOf(init).authorization).toBe("Bearer test-key");
    }
  });

  it("never ask tagit-services about an id that is not a product id", async () => {
    for (const bad of [
      "../businesses/other",
      "tpl_1/publish",
      "tpl_1?x=1",
      "tpl_",
      "",
      "x",
      "tpl_a b",
    ]) {
      expect(await getBrandProduct(session, bad), bad).toBeNull();
      expect(await updateBrandProduct(session, bad, body), bad).toBe(false);
      expect(await publishBrandProduct(session, bad), bad).toBe(false);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("show nothing for another brand's product, even if tagit-services sent it", async () => {
    fetchMock.mockReturnValue(
      answer(200, { ok: true, template: { ...template, businessId: "other" } }),
    );
    expect(await getBrandProduct(session, "tpl_1")).toBeNull();
    fetchMock.mockReturnValue(
      answer(201, { ok: true, template: { ...template, businessId: "other" } }),
    );
    expect(await createBrandProduct(session, body)).toBeNull();
  });

  it("report a refusal or an outage as not done, and never throw", async () => {
    for (const status of [400, 403, 404, 409, 500]) {
      fetchMock.mockReturnValue(answer(status, { ok: true, template }));
      expect(await getBrandProduct(session, "tpl_1"), String(status)).toBeNull();
      expect(await createBrandProduct(session, body), String(status)).toBeNull();
      expect(await updateBrandProduct(session, "tpl_1", body), String(status)).toBe(false);
      expect(await publishBrandProduct(session, "tpl_1"), String(status)).toBe(false);
      expect(await uploadBrandPhoto(session, new Blob(["x"])), String(status)).toBeNull();
    }
    fetchMock.mockRejectedValue(new Error("network"));
    expect(await createBrandProduct(session, body)).toBeNull();
    expect(await updateBrandProduct(session, "tpl_1", body)).toBe(false);
    expect(await publishBrandProduct(session, "tpl_1")).toBe(false);
    expect(await uploadBrandPhoto(session, new Blob(["x"]))).toBeNull();
    // A 200 whose body says it failed is not a success either.
    fetchMock.mockReset();
    fetchMock.mockReturnValue(answer(200, { ok: false }));
    expect(await updateBrandProduct(session, "tpl_1", body)).toBe(false);
  });

  it("upload a photo as one file in the field tagit-services reads, under the same headers", async () => {
    fetchMock.mockReturnValue(answer(201, { ok: true, media: [{ urls: { lg: PHOTO } }] }));
    expect(await uploadBrandPhoto(session, new Blob(["img"], { type: "image/png" }))).toBe(PHOTO);
    const [url, init] = last();
    expect(url).toBe("https://services.test/api/v1/media");
    expect(init.method).toBe("POST");
    const form = init.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect([...form.keys()]).toEqual(["files"]);
    // fetch sets the multipart content type itself.
    expect(headersOf(init)["content-type"]).toBeUndefined();
    expect(headersOf(init)["x-business-id"]).toBe("acme");
  });

  it("take a stored photo's address only when it is one of ours", async () => {
    fetchMock.mockReturnValue(
      answer(201, { ok: true, media: [{ urls: { lg: "https://evil.example/x.webp" } }] }),
    );
    expect(await uploadBrandPhoto(session, new Blob(["img"]))).toBeNull();
  });
});
