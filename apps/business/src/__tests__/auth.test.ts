import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The sign-in rules as the library will run them (TAP-T17): the config that
 * src/auth.ts hands to NextAuth is captured and its callbacks are called
 * directly, with the roster answered by a stubbed fetch.
 */
type Callbacks = {
  signIn: (args: Record<string, unknown>) => Promise<boolean | string>;
  jwt: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
  session: (args: Record<string, unknown>) => { user: Record<string, unknown> };
};
const captured: { config?: Record<string, unknown> & { callbacks: Callbacks } } = {};

vi.mock("next-auth", () => ({
  default: (config: Record<string, unknown> & { callbacks: Callbacks }) => {
    captured.config = config;
    return { handlers: {}, auth: vi.fn() };
  },
}));
vi.mock("next-auth/providers/google", () => ({ default: { id: "google" } }));

const fetchMock = vi.fn();
const roster = (user: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify({ ok: status === 200, user }), { status }));

beforeEach(async () => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("SERVICES_API_KEY", "test-key");
  vi.stubEnv("SERVICES_URL", "https://services.test");
  await import("@/auth");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

const google = { provider: "google" };
const cb = () => captured.config!.callbacks;

describe("the config", () => {
  it("has Google as the only provider, a 12 h token session and its own pages", () => {
    const config = captured.config!;
    expect(config.providers).toEqual([{ id: "google" }]);
    expect(config.session).toEqual({ strategy: "jwt", maxAge: 43_200 });
    expect(config.jwt).toEqual({ maxAge: 43_200 });
    expect(config.pages).toEqual({ signIn: "/signin", error: "/signin" });
  });
});

describe("signIn", () => {
  it("lets a verified brand user in", async () => {
    fetchMock.mockReturnValue(roster({ role: "viewer", businessId: "acme" }));
    await expect(
      cb().signIn({ account: google, profile: { email: "Jane@Acme.com", email_verified: true } }),
    ).resolves.toBe(true);
    expect((fetchMock.mock.calls[0] as [string])[0]).toContain("/by-email/jane%40acme.com");
  });

  it("sends TAG IT staff and unknown emails to the same page, with no session", async () => {
    fetchMock.mockReturnValueOnce(roster({ role: "admin", businessId: null }));
    await expect(
      cb().signIn({
        account: google,
        profile: { email: "staff@tagit.test", email_verified: true },
      }),
    ).resolves.toBe("/no-access");
    fetchMock.mockReturnValueOnce(roster(undefined, 404));
    await expect(
      cb().signIn({ account: google, profile: { email: "who@x.test", email_verified: true } }),
    ).resolves.toBe("/no-access");
  });

  it("refuses an unverified email even when the roster knows it", async () => {
    fetchMock.mockReturnValue(roster({ role: "admin", businessId: "acme" }));
    await expect(
      cb().signIn({ account: google, profile: { email: "jane@acme.com", email_verified: false } }),
    ).resolves.toBe("/no-access");
    await expect(
      cb().signIn({ account: google, profile: { email: "jane@acme.com" } }),
    ).resolves.toBe("/no-access");
  });

  it("refuses when the roster cannot be read", async () => {
    fetchMock.mockRejectedValue(new Error("down"));
    await expect(
      cb().signIn({ account: google, profile: { email: "jane@acme.com", email_verified: true } }),
    ).resolves.toBe("/no-access");
  });

  it("refuses a sign-in that is not from Google or has no email", async () => {
    fetchMock.mockReturnValue(roster({ role: "admin", businessId: "acme" }));
    await expect(
      cb().signIn({
        account: { provider: "credentials" },
        profile: { email: "jane@acme.com", email_verified: true },
      }),
    ).resolves.toBe("/no-access");
    await expect(cb().signIn({ account: google, profile: { email_verified: true } })).resolves.toBe(
      "/no-access",
    );
  });
});

describe("jwt", () => {
  it("reads role and brand from the roster on a fresh sign-in", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_800_000_000_000);
    fetchMock.mockReturnValue(roster({ role: "operator", businessId: "acme" }));
    const token = await cb().jwt({ token: { email: "jane@acme.com" }, account: google });
    expect(token).toMatchObject({
      role: "operator",
      businessId: "acme",
      roleFetchedAt: 1_800_000_000_000,
    });
  });

  it("does not ask again while the copy is fresh", async () => {
    const token = {
      email: "jane@acme.com",
      role: "admin",
      businessId: "acme",
      roleFetchedAt: Date.now(),
    };
    await expect(cb().jwt({ token: { ...token } })).resolves.toEqual(token);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("re-reads a stale copy and takes away what the roster no longer says", async () => {
    const old = Date.now() - 5 * 60 * 1000;
    const token = { email: "jane@acme.com", role: "admin", businessId: "acme", roleFetchedAt: old };

    fetchMock.mockReturnValueOnce(roster(undefined, 404)); // removed from the roster
    const removed = await cb().jwt({ token: { ...token } });
    expect(removed.role).toBeNull();
    expect(removed.businessId).toBeNull();

    fetchMock.mockReturnValueOnce(roster({ role: "viewer", businessId: "other" })); // moved
    const moved = await cb().jwt({ token: { ...token } });
    expect(moved).toMatchObject({ role: "viewer", businessId: "other" });

    fetchMock.mockReturnValueOnce(roster({ role: "admin", businessId: null })); // made staff
    const staff = await cb().jwt({ token: { ...token } });
    expect(staff).toMatchObject({ role: "admin", businessId: null });

    fetchMock.mockRejectedValueOnce(new Error("down")); // roster unreachable: fail closed
    const down = await cb().jwt({ token: { ...token } });
    expect(down.role).toBeNull();
    expect(down.businessId).toBeNull();
  });

  it("treats a token with no stamp, or a forged future stamp, as stale", async () => {
    fetchMock.mockReturnValue(roster(undefined, 404));
    const forged = await cb().jwt({
      token: {
        email: "x@y.test",
        role: "admin",
        businessId: "acme",
        roleFetchedAt: Date.now() + 9e9,
      },
    });
    expect(forged.role).toBeNull();
    const bare = await cb().jwt({
      token: { email: "x@y.test", role: "admin", businessId: "acme" },
    });
    expect(bare.businessId).toBeNull();
  });

  it("clears role and brand for a token with no email", async () => {
    const token = await cb().jwt({ token: { role: "admin", businessId: "acme" }, account: google });
    expect(token.role).toBeNull();
    expect(token.businessId).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("session", () => {
  it("copies a clean role and brand, and nothing malformed", () => {
    const run = (token: Record<string, unknown>) =>
      cb().session({ session: { user: { email: "jane@acme.com" } }, token }).user;
    expect(run({ role: "operator", businessId: "acme" })).toMatchObject({
      role: "operator",
      businessId: "acme",
    });
    expect(run({ role: "owner", businessId: "" })).toMatchObject({ role: null, businessId: null });
    expect(run({})).toMatchObject({ role: null, businessId: null });
    expect(run({ role: "admin", businessId: { id: "acme" } })).toMatchObject({ businessId: null });
  });
});
