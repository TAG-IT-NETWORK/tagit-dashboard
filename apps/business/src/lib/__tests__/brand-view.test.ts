import { describe, expect, it } from "vitest";

import { toBrandSession } from "@/lib/brand-session";
import { brandInitials, parseBrandProfile, roleWords, safeLogoUrl } from "@/lib/brand-view";

describe("safeLogoUrl", () => {
  it("keeps a plain https address", () => {
    expect(safeLogoUrl("https://media.tagit.network/logos/acme.png")).toBe(
      "https://media.tagit.network/logos/acme.png",
    );
  });
  it("drops everything else", () => {
    for (const bad of [
      "http://media.tagit.network/a.png",
      "javascript:alert(1)",
      "data:image/svg+xml,<svg onload=alert(1)>",
      "/logos/acme.png",
      "//evil.example/a.png",
      "https://user:pass@evil.example/a.png",
      "https://user@evil.example/a.png",
      "not a url",
      "",
      null,
      undefined,
      7,
      `https://a.example/${"x".repeat(500)}`,
    ]) {
      expect(safeLogoUrl(bad), String(bad)).toBeNull();
    }
  });
});

describe("parseBrandProfile", () => {
  const good = {
    ok: true,
    business: { id: "acme", name: " Acme Goods ", logoUrl: "https://m.example/a.png" },
  };
  it("reads the brand's own record", () => {
    expect(parseBrandProfile(200, good, "acme")).toEqual({
      name: "Acme Goods",
      nameKnown: true,
      logoUrl: "https://m.example/a.png",
    });
  });
  it("never shows a record that is about another brand", () => {
    expect(parseBrandProfile(200, good, "other")).toEqual({
      name: "other",
      nameKnown: false,
      logoUrl: null,
    });
  });
  it("opens under the brand id when the record cannot be read", () => {
    const fallback = { name: "acme", nameKnown: false, logoUrl: null };
    expect(parseBrandProfile(404, { ok: false }, "acme")).toEqual(fallback);
    expect(parseBrandProfile(500, good, "acme")).toEqual(fallback);
    expect(parseBrandProfile(0, null, "acme")).toEqual(fallback);
    expect(parseBrandProfile(200, { ...good, ok: false }, "acme")).toEqual(fallback);
    expect(parseBrandProfile(200, "x", "acme")).toEqual(fallback);
  });
  it("uses the id for a blank name and drops an unsafe logo", () => {
    expect(
      parseBrandProfile(
        200,
        { ok: true, business: { id: "acme", name: "  ", logoUrl: "javascript:1" } },
        "acme",
      ),
    ).toEqual({ name: "acme", nameKnown: false, logoUrl: null });
    expect(
      parseBrandProfile(200, { ok: true, business: { id: "acme", name: 7 } }, "acme").name,
    ).toBe("acme");
  });
  it("cuts an over-long name", () => {
    const long = { ok: true, business: { id: "acme", name: "n".repeat(500) } };
    expect(parseBrandProfile(200, long, "acme").name).toHaveLength(200);
  });
});

describe("roleWords / brandInitials", () => {
  it("says the role in plain words", () => {
    expect(roleWords("admin")).toBe("Manager");
    expect(roleWords("operator")).toBe("Editor");
    expect(roleWords("viewer")).toBe("View only");
  });
  it("makes one or two initials", () => {
    expect(brandInitials("Acme Goods Inc")).toBe("AG");
    expect(brandInitials("acme")).toBe("A");
    expect(brandInitials("l'oréal-paris")).toBe("LP");
    expect(brandInitials("  ")).toBe("?");
    expect(brandInitials("—")).toBe("?");
  });
});

describe("toBrandSession", () => {
  it("builds a brand session from a full session user", () => {
    expect(
      toBrandSession({ email: " Jane@Acme.com", role: "operator", businessId: "acme" }),
    ).toEqual({
      email: "jane@acme.com",
      role: "operator",
      brandId: "acme",
    });
  });
  it("is null when any of email, role or brand is missing or wrong", () => {
    const full = { email: "jane@acme.com", role: "viewer", businessId: "acme" };
    for (const bad of [
      null,
      undefined,
      "jane@acme.com",
      { ...full, email: undefined },
      { ...full, email: "" },
      { ...full, role: null },
      { ...full, role: "owner" },
      { ...full, businessId: null },
      { ...full, businessId: "" },
      { ...full, businessId: ["acme"] },
    ]) {
      expect(toBrandSession(bad)).toBeNull();
    }
  });
});

describe("parseBrandProfile: is the name the brand's real one?", () => {
  it("says so only when the name was read from the brand's own record", () => {
    const record = (name: unknown, id = "acme") => ({
      ok: true,
      business: { id, name, logoUrl: null },
    });
    expect(parseBrandProfile(200, record("Acme"), "acme").nameKnown).toBe(true);
    // A brand whose real name happens to equal its id is still known.
    expect(parseBrandProfile(200, record("acme"), "acme")).toMatchObject({
      name: "acme",
      nameKnown: true,
    });
    for (const [status, body] of [
      [200, record("  ")],
      [200, record(null)],
      [200, record(7)],
      [200, record("Acme", "other")],
      [404, record("Acme")],
      [500, record("Acme")],
      [0, null],
      [200, { ok: false, business: { id: "acme", name: "Acme" } }],
    ] as Array<[number, unknown]>) {
      expect(parseBrandProfile(status, body, "acme"), JSON.stringify(body)).toMatchObject({
        name: "acme",
        nameKnown: false,
      });
    }
  });
});
