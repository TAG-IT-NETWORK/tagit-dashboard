import { describe, expect, it } from "vitest";

import {
  ROLE_TTL_MS,
  SESSION_MAX_AGE_SECONDS,
  roleIsStale,
  shouldRefreshRole,
} from "@/lib/role-refresh";
import { authConfigured } from "@/lib/auth-config";

const now = 1_800_000_000_000;

describe("roleIsStale", () => {
  it("trusts a stamp younger than five minutes", () => {
    expect(ROLE_TTL_MS).toBe(300_000);
    expect(roleIsStale(now, now)).toBe(false);
    expect(roleIsStale(now - ROLE_TTL_MS + 1, now)).toBe(false);
  });
  it("is stale at five minutes and after", () => {
    expect(roleIsStale(now - ROLE_TTL_MS, now)).toBe(true);
    expect(roleIsStale(now - ROLE_TTL_MS - 1, now)).toBe(true);
  });
  it("is stale for a missing, malformed or future stamp", () => {
    for (const bad of [undefined, null, "1", NaN, Infinity, {}, now + 1]) {
      expect(roleIsStale(bad, now)).toBe(true);
    }
  });
});

describe("shouldRefreshRole", () => {
  const fresh = { roleFetchedAt: now, now };
  it("always re-reads on a fresh sign-in and on an explicit update", () => {
    expect(shouldRefreshRole({ ...fresh, freshSignIn: true })).toBe(true);
    expect(shouldRefreshRole({ ...fresh, freshSignIn: false, trigger: "update" })).toBe(true);
  });
  it("otherwise lets the age decide", () => {
    expect(shouldRefreshRole({ ...fresh, freshSignIn: false })).toBe(false);
    expect(shouldRefreshRole({ ...fresh, freshSignIn: false, trigger: "signIn" })).toBe(false);
    expect(shouldRefreshRole({ roleFetchedAt: now - ROLE_TTL_MS, now, freshSignIn: false })).toBe(
      true,
    );
  });
  it("caps the session at twelve hours", () => {
    expect(SESSION_MAX_AGE_SECONDS).toBe(43_200);
  });
});

describe("authConfigured", () => {
  const full = { AUTH_SECRET: "s", AUTH_GOOGLE_ID: "i", AUTH_GOOGLE_SECRET: "g" };
  it("needs all three settings", () => {
    expect(authConfigured(full)).toBe(true);
    for (const key of Object.keys(full) as Array<keyof typeof full>) {
      expect(authConfigured({ ...full, [key]: "" }), key).toBe(false);
      expect(authConfigured({ ...full, [key]: undefined }), key).toBe(false);
    }
    expect(authConfigured({})).toBe(false);
  });
});
