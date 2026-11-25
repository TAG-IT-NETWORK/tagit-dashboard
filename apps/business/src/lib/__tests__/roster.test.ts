import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  NOBODY,
  canonicalEmail,
  fetchRoster,
  isBrandIdentity,
  parseRosterResponse,
} from "@/lib/roster";
import { mayStartSession } from "@/lib/sign-in-gate";

const row = (user: unknown) => ({ ok: true, user });

describe("parseRosterResponse", () => {
  it("reads role and brand from a good answer", () => {
    expect(parseRosterResponse(200, row({ role: "operator", businessId: "acme" }))).toEqual({
      role: "operator",
      brand: "acme",
    });
  });

  it("reads TAG IT staff as a role with no brand", () => {
    expect(parseRosterResponse(200, row({ role: "admin", businessId: null }))).toEqual({
      role: "admin",
      brand: null,
    });
    expect(parseRosterResponse(200, row({ role: "admin" })).brand).toBeNull();
    expect(parseRosterResponse(200, row({ role: "admin", businessId: "" })).brand).toBeNull();
  });

  it("is nobody for any answer that is not a clean 200", () => {
    const good = row({ role: "admin", businessId: "acme" });
    expect(parseRosterResponse(404, good)).toEqual(NOBODY);
    expect(parseRosterResponse(500, good)).toEqual(NOBODY);
    expect(parseRosterResponse(200, null)).toEqual(NOBODY);
    expect(parseRosterResponse(200, "ok")).toEqual(NOBODY);
    expect(
      parseRosterResponse(200, { ok: false, user: { role: "admin", businessId: "acme" } }),
    ).toEqual(NOBODY);
    expect(parseRosterResponse(200, { user: { role: "admin", businessId: "acme" } })).toEqual(
      NOBODY,
    );
  });

  it("drops the brand when the role is not a real role", () => {
    expect(parseRosterResponse(200, row({ role: "owner", businessId: "acme" }))).toEqual(NOBODY);
    expect(parseRosterResponse(200, row({ businessId: "acme" }))).toEqual(NOBODY);
  });
});

describe("isBrandIdentity", () => {
  it("is true only with a role and a brand", () => {
    expect(isBrandIdentity({ role: "viewer", brand: "acme" })).toBe(true);
    expect(isBrandIdentity({ role: "admin", brand: null })).toBe(false);
    expect(isBrandIdentity({ role: null, brand: "acme" })).toBe(false);
    expect(isBrandIdentity(NOBODY)).toBe(false);
  });
});

describe("canonicalEmail", () => {
  it("trims and lowercases", () => {
    expect(canonicalEmail("  Jane@Acme.COM ")).toBe("jane@acme.com");
  });
  it("is null for anything that is not a usable email string", () => {
    for (const bad of [undefined, null, "", "  ", "a", 7, {}, "x".repeat(321)]) {
      expect(canonicalEmail(bad)).toBeNull();
    }
  });
});

describe("mayStartSession", () => {
  const brand = { role: "viewer", brand: "acme" } as const;
  it("lets in a verified Google account that the roster ties to a brand", () => {
    expect(mayStartSession({ provider: "google", emailVerified: true, identity: brand })).toBe(
      true,
    );
  });
  it("refuses TAG IT staff and unknown emails alike", () => {
    expect(
      mayStartSession({
        provider: "google",
        emailVerified: true,
        identity: { role: "admin", brand: null },
      }),
    ).toBe(false);
    expect(mayStartSession({ provider: "google", emailVerified: true, identity: NOBODY })).toBe(
      false,
    );
  });
  it("refuses an email Google has not verified", () => {
    for (const emailVerified of [false, undefined, null, "true", 1]) {
      expect(mayStartSession({ provider: "google", emailVerified, identity: brand })).toBe(false);
    }
  });
  it("refuses any other provider", () => {
    for (const provider of ["credentials", "github", undefined, null]) {
      expect(mayStartSession({ provider, emailVerified: true, identity: brand })).toBe(false);
    }
  });
});

describe("fetchRoster", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("SERVICES_API_KEY", "test-key");
    vi.stubEnv("SERVICES_URL", "https://services.test");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  const answer = (status: number, body: unknown) =>
    Promise.resolve(new Response(JSON.stringify(body), { status }));

  it("asks services for the canonical email, with the key and no brand header", async () => {
    fetchMock.mockReturnValue(answer(200, row({ role: "admin", businessId: "acme" })));
    await expect(fetchRoster(" Jane+x@Acme.com ")).resolves.toEqual({
      role: "admin",
      brand: "acme",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://services.test/api/v1/admin/users/by-email/jane%2Bx%40acme.com");
    expect(init.headers).toEqual({ authorization: "Bearer test-key" });
    expect(init.cache).toBe("no-store");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("cannot be steered to another path by the email", async () => {
    fetchMock.mockReturnValue(answer(404, { ok: false }));
    await fetchRoster("a/../../businesses?x=@b.c");
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(new URL(url).pathname).toBe(
      "/api/v1/admin/users/by-email/a%2F..%2F..%2Fbusinesses%3Fx%3D%40b.c",
    );
    expect(new URL(url).search).toBe("");
  });

  it("is nobody, without calling out, when there is no key or no email", async () => {
    vi.stubEnv("SERVICES_API_KEY", "");
    await expect(fetchRoster("jane@acme.com")).resolves.toEqual(NOBODY);
    vi.stubEnv("SERVICES_API_KEY", "test-key");
    await expect(fetchRoster(undefined)).resolves.toEqual(NOBODY);
    await expect(fetchRoster("")).resolves.toEqual(NOBODY);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is nobody when services is down, slow or answers nonsense", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network"));
    await expect(fetchRoster("jane@acme.com")).resolves.toEqual(NOBODY);
    fetchMock.mockReturnValueOnce(Promise.resolve(new Response("<html>", { status: 200 })));
    await expect(fetchRoster("jane@acme.com")).resolves.toEqual(NOBODY);
    fetchMock.mockReturnValueOnce(answer(404, { ok: false, error: "NOT_FOUND" }));
    await expect(fetchRoster("jane@acme.com")).resolves.toEqual(NOBODY);
  });

  it("falls back to the production services address", async () => {
    vi.stubEnv("SERVICES_URL", "");
    fetchMock.mockReturnValue(answer(404, {}));
    await fetchRoster("jane@acme.com");
    expect((fetchMock.mock.calls[0] as [string])[0]).toMatch(
      /^https:\/\/api\.tagit\.network\/api\/v1\//,
    );
  });
});
