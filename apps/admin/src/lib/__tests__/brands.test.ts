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

// ── Logo upload (TAP-T17) ────────────────────────────────────────────────────

import { LOGO_MAX_BYTES, isShowableLogo, logoFileProblem, logoUrlFromUpload } from "../brands";

describe("logoFileProblem", () => {
  it("accepts PNG, JPG and WebP within the size limit", () => {
    for (const type of ["image/png", "image/jpeg", "image/webp"]) {
      expect(logoFileProblem({ type, size: 1 })).toBeNull();
      expect(logoFileProblem({ type, size: LOGO_MAX_BYTES })).toBeNull();
    }
  });

  it("refuses other kinds of file, in words", () => {
    for (const type of [
      "image/svg+xml",
      "image/heic",
      "image/gif",
      "application/pdf",
      "text/html",
      "",
    ]) {
      expect(logoFileProblem({ type, size: 10 }), type).toMatch(/PNG, JPG or WebP/);
    }
  });

  it("refuses a file over the limit and an empty file", () => {
    expect(logoFileProblem({ type: "image/png", size: LOGO_MAX_BYTES + 1 })).toMatch(
      /over 4\.5 MB/,
    );
    expect(logoFileProblem({ type: "image/png", size: 0 })).toMatch(/empty/);
  });
});

describe("isShowableLogo", () => {
  it("is true for a plain https address", () => {
    expect(isShowableLogo("https://media.tagit.network/i/abc/sm.webp")).toBe(true);
  });

  it("is false for everything else", () => {
    for (const bad of [
      "http://media.tagit.network/i/abc/sm.webp",
      "javascript:alert(1)",
      "data:image/png;base64,AAAA",
      "/i/abc/sm.webp",
      "//evil.example/a.png",
      "https://user:pass@evil.example/a.png",
      "https://user@evil.example/a.png",
      "not an address",
      "",
      null,
      undefined,
      7,
      `https://a.example/${"x".repeat(500)}`,
    ]) {
      expect(isShowableLogo(bad), String(bad)).toBe(false);
    }
  });
});

describe("logoUrlFromUpload", () => {
  const urls = {
    orig: "https://media.tagit.network/i/abc/orig.webp",
    lg: "https://media.tagit.network/i/abc/lg.webp",
    md: "https://media.tagit.network/i/abc/md.webp",
    sm: "https://media.tagit.network/i/abc/sm.webp",
    t: "https://media.tagit.network/i/abc/t.webp",
  };

  it("takes the small copy, never the cropped thumbnail", () => {
    expect(logoUrlFromUpload({ ok: true, media: [{ sha256: "abc", urls }] })).toBe(urls.sm);
  });

  it("falls back to a larger copy when the small one is missing or unsafe", () => {
    expect(logoUrlFromUpload({ ok: true, media: [{ urls: { ...urls, sm: undefined } }] })).toBe(
      urls.md,
    );
    expect(
      logoUrlFromUpload({
        ok: true,
        media: [{ urls: { ...urls, sm: "http://x/sm.webp", md: 7 } }],
      }),
    ).toBe(urls.lg);
    expect(logoUrlFromUpload({ ok: true, media: [{ urls: { t: urls.t } }] })).toBeNull();
  });

  it("is null for an answer that is not a successful upload", () => {
    for (const bad of [
      null,
      undefined,
      "ok",
      {},
      { ok: true },
      { ok: true, media: [] },
      { ok: true, media: {} },
      { ok: true, media: [{}] },
      { ok: true, media: [{ urls: null }] },
      { ok: true, media: [{ urls: { sm: "javascript:alert(1)" } }] },
      { ok: false, media: [{ urls }] },
      { media: [{ urls }] },
    ]) {
      expect(logoUrlFromUpload(bad)).toBeNull();
    }
  });
});
