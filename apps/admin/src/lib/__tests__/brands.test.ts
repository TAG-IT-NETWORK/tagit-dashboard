// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  brandError,
  describeAssign,
  isValidBrandId,
  isWalletOrEmpty,
  parseAssignOutcome,
  parseBrands,
  suggestBrandId,
  unassignedTemplates,
} from "../brands";

/** TAP-T16: what the Brands page reads and says. */

describe("parseBrands", () => {
  it("keeps the five fields, and turns an empty value into none", () => {
    expect(
      parseBrands([
        {
          id: "aurora",
          name: "Aurora",
          logoUrl: "",
          treasuryWallet: "0xabc",
          defaultMintRecipient: null,
          secret: "x",
        },
      ]),
    ).toEqual([
      {
        id: "aurora",
        name: "Aurora",
        logoUrl: null,
        treasuryWallet: "0xabc",
        defaultMintRecipient: null,
      },
    ]);
  });

  it("drops rows without an id or a name, and anything that is not a list", () => {
    expect(parseBrands([{ id: "a" }, { name: "B" }, null, "x", { id: 5, name: "N" }])).toEqual([]);
    for (const value of [undefined, null, {}, "list", 3]) expect(parseBrands(value)).toEqual([]);
  });
});

describe("unassignedTemplates", () => {
  it("offers a template only when the answer says it has no brand", () => {
    expect(
      unassignedTemplates([
        { id: "t1", name: "One", sku: "S", status: "published", businessId: null },
        { id: "t2", name: "Two", businessId: "aurora" },
        { id: "t3", name: "Three" },
        { id: "t4", businessId: null },
        { id: "t5", name: "Five", businessId: "" },
      ]),
    ).toEqual([
      { id: "t1", name: "One", sku: "S", status: "published" },
      { id: "t4", name: "t4", sku: null, status: "draft" },
    ]);
  });
});

describe("a new brand's id", () => {
  it("is suggested from the name", () => {
    expect(suggestBrandId("Aurora Skin Co.")).toBe("aurora-skin-co");
    expect(suggestBrandId("  L'Oréal  Paris ")).toBe("l-oreal-paris");
    expect(suggestBrandId("---")).toBe("");
    expect(suggestBrandId("x".repeat(100))).toHaveLength(63);
  });

  it("is valid exactly as tagit-services takes it", () => {
    for (const id of ["ab", "aurora", "aurora-skin-2", "9lives", "a".repeat(63)]) {
      expect(isValidBrandId(id)).toBe(true);
    }
    for (const id of ["", "a", "Aurora", "au rora", "-aurora", "aurora_skin", "a".repeat(64)]) {
      expect(isValidBrandId(id)).toBe(false);
    }
  });
});

describe("isWalletOrEmpty", () => {
  it("takes nothing, or forty hex characters after 0x", () => {
    expect(isWalletOrEmpty("")).toBe(true);
    expect(isWalletOrEmpty(`0x${"aB".repeat(20)}`)).toBe(true);
    for (const value of [
      "0x123",
      `${"a".repeat(40)}`,
      `0x${"g".repeat(40)}`,
      `0x${"a".repeat(41)}`,
      " ",
    ]) {
      expect(isWalletOrEmpty(value)).toBe(false);
    }
  });
});

describe("brandError", () => {
  it("says something a person can act on, and never just a code", () => {
    const codes = [
      "BUSINESS_EXISTS",
      "UNKNOWN_BUSINESS",
      "NOT_FOUND",
      "PLATFORM_ONLY",
      "FORBIDDEN",
      "VALIDATION_ERROR",
      "INVALID_REQUEST",
      "UNAUTHENTICATED",
      "UPSTREAM_FAILED",
      undefined,
      { x: 1 },
    ];
    for (const code of codes) {
      const sentence = brandError(code, 500);
      expect(sentence).toMatch(/^[A-Z].*\.$/);
      expect(sentence).not.toMatch(/[A-Z]{3,}_[A-Z]/);
    }
    expect(brandError("BUSINESS_EXISTS", 409)).toContain("already exists");
    expect(brandError("anything else", 502)).toContain("502");
  });
});

describe("what an assign did", () => {
  const outcome = (over: Record<string, unknown> = {}) =>
    parseAssignOutcome({
      ok: true,
      templates: { assigned: [], skipped: [] },
      items: { assigned: [], skipped: [] },
      listings: 0,
      ...over,
    })!;

  it("is not read from an answer that is not ok", () => {
    expect(parseAssignOutcome({ ok: false, error: "PLATFORM_ONLY" })).toBeNull();
    expect(parseAssignOutcome(null)).toBeNull();
  });

  it("is read defensively", () => {
    expect(
      parseAssignOutcome({
        ok: true,
        templates: { assigned: ["a", 5], skipped: [{ id: "b" }, { id: "c", reason: "has_brand" }] },
      }),
    ).toEqual({
      templates: { assigned: ["a"], skipped: [{ id: "c", reason: "has_brand" }] },
      items: { assigned: [], skipped: [] },
      listings: 0,
    });
  });

  it("is told in plain sentences, singular and plural", () => {
    expect(
      describeAssign(outcome({ templates: { assigned: ["t1"], skipped: [] } }), "Aurora"),
    ).toEqual(["1 product now belongs to Aurora, with every item made from it."]);
    expect(
      describeAssign(outcome({ templates: { assigned: ["t1", "t2"], skipped: [] } }), "Aurora"),
    ).toEqual(["2 products now belong to Aurora, with every item made from them."]);
    expect(describeAssign(outcome({ items: { assigned: ["10"], skipped: [] } }), "Aurora")).toEqual(
      ["1 single item now belongs to Aurora."],
    );
  });

  it("says so when nothing moved, and why each thing was left", () => {
    expect(
      describeAssign(
        outcome({
          templates: {
            assigned: [],
            skipped: [
              { id: "t1", reason: "has_brand" },
              { id: "t2", reason: "not_found" },
            ],
          },
          items: {
            assigned: [],
            skipped: [
              { id: "4", reason: "has_template" },
              { id: "5", reason: "new_reason" },
            ],
          },
        }),
        "Aurora",
      ),
    ).toEqual([
      "Nothing was moved.",
      "t1 already belongs to a brand.",
      "t2 was not found.",
      "4 belongs to a product; give the product instead.",
      "5 was left as it is.",
    ]);
  });
});
