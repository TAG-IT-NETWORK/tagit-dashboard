import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { tapCountryOf, TAP_COUNTRY_HEADER } = await import("../tap-country");

const headers = (value: string | null) => ({
  get: (name: string) => (name === TAP_COUNTRY_HEADER ? value : "203.0.113.9"),
});

describe("tapCountryOf", () => {
  it("reads the host's country header and nothing else", () => {
    expect(TAP_COUNTRY_HEADER).toBe("x-vercel-ip-country");
    expect(tapCountryOf(headers("DE"))).toBe("DE");
    expect(tapCountryOf(headers(" us "))).toBe("US");
  });

  it.each([null, "", "XX", "USA", "U", "1A", "<b>", "203.0.113.9"])(
    "gives null for %s",
    (value) => {
      expect(tapCountryOf(headers(value))).toBeNull();
    },
  );
});
