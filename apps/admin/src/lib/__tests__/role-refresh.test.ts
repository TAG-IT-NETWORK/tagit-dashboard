// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  ROLE_TTL_MS,
  SESSION_MAX_AGE_SECONDS,
  roleIsStale,
  shouldRefreshRole,
} from "../role-refresh";

/**
 * WB-02: the session-JWT role cache must re-resolve WITHOUT user cooperation.
 * This pins the pure TTL decision the auth.ts `jwt` callback runs on every
 * request — if a case here changes, live demotion latency changed.
 */

const NOW = 1_700_000_000_000;

describe("constants", () => {
  it("role TTL is 5 minutes", () => {
    expect(ROLE_TTL_MS).toBe(5 * 60 * 1000);
  });

  it("session/JWT lifetime is 12 hours", () => {
    expect(SESSION_MAX_AGE_SECONDS).toBe(12 * 60 * 60);
  });
});

describe("roleIsStale", () => {
  it("fresh within the TTL", () => {
    expect(roleIsStale(NOW, NOW)).toBe(false);
    expect(roleIsStale(NOW - ROLE_TTL_MS + 1, NOW)).toBe(false);
  });

  it("stale exactly AT the TTL boundary and beyond (demotion lands ≤ 5 min)", () => {
    expect(roleIsStale(NOW - ROLE_TTL_MS, NOW)).toBe(true);
    expect(roleIsStale(NOW - ROLE_TTL_MS - 1, NOW)).toBe(true);
    expect(roleIsStale(NOW - 12 * 60 * 60 * 1000, NOW)).toBe(true);
  });

  it("missing/garbage claim is stale — fail closed", () => {
    for (const claim of [undefined, null, "recent", NaN, Infinity, -Infinity, {}, []]) {
      expect(roleIsStale(claim, NOW), String(claim)).toBe(true);
    }
  });

  it("a future timestamp (skew or forged claim) is stale — fail closed", () => {
    expect(roleIsStale(NOW + 1, NOW)).toBe(true);
    expect(roleIsStale(NOW + ROLE_TTL_MS * 10, NOW)).toBe(true);
  });
});

describe("shouldRefreshRole — the jwt-callback decision", () => {
  const fresh = { freshSignIn: false, roleFetchedAt: NOW - 1_000, now: NOW } as const;

  it("always refetches on a fresh sign-in", () => {
    expect(shouldRefreshRole({ ...fresh, freshSignIn: true })).toBe(true);
  });

  it("always refetches on an explicit session update (/team edits)", () => {
    expect(shouldRefreshRole({ ...fresh, trigger: "update" })).toBe(true);
  });

  it("skips the refetch while the cached role is inside the TTL", () => {
    expect(shouldRefreshRole(fresh)).toBe(false);
    expect(shouldRefreshRole({ ...fresh, trigger: "signIn" })).toBe(false);
  });

  it("refetches once the cache ages past the TTL — no user cooperation needed", () => {
    expect(
      shouldRefreshRole({ freshSignIn: false, roleFetchedAt: NOW - ROLE_TTL_MS, now: NOW }),
    ).toBe(true);
  });

  it("refetches when the claim was never stamped (pre-WB-02 tokens)", () => {
    expect(shouldRefreshRole({ freshSignIn: false, roleFetchedAt: undefined, now: NOW })).toBe(
      true,
    );
  });
});
