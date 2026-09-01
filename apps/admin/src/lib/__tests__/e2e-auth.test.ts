import { describe, it, expect, afterEach } from "vitest";

import { isE2EAuthBypass } from "../e2e-auth";

/**
 * The seam must be DOUBLE-gated: explicit opt-in env var AND a
 * non-production build. A production deployment must ignore the var even if
 * it leaks into the environment.
 */
describe("isE2EAuthBypass", () => {
  const origBypass = process.env.E2E_AUTH_BYPASS;
  const origNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (origBypass === undefined) delete process.env.E2E_AUTH_BYPASS;
    else process.env.E2E_AUTH_BYPASS = origBypass;
    process.env.NODE_ENV = origNodeEnv;
  });

  it("is OFF by default", () => {
    delete process.env.E2E_AUTH_BYPASS;
    expect(isE2EAuthBypass()).toBe(false);
  });

  it("is ON only with the exact opt-in value outside production", () => {
    process.env.E2E_AUTH_BYPASS = "true";
    process.env.NODE_ENV = "test";
    expect(isE2EAuthBypass()).toBe(true);

    process.env.E2E_AUTH_BYPASS = "1"; // not the exact literal
    expect(isE2EAuthBypass()).toBe(false);
  });

  it("stays OFF in production builds even when the var is set", () => {
    process.env.E2E_AUTH_BYPASS = "true";
    process.env.NODE_ENV = "production";
    expect(isE2EAuthBypass()).toBe(false);
  });
});
