import { describe, it, expect } from "vitest";
import {
  anchorVerdict,
  applyRegistryFilters,
  compareIntegrity,
  hasDrift,
  needsProductInfo,
  parseRegistryFilters,
  registryHref,
  registryRowFromAdminItem,
  validateOverridesDoc,
} from "../logic";
import type { RegistryRow } from "../types";

const HASH_A = `0x${"ab".repeat(32)}`;
const HASH_B = `0x${"cd".repeat(32)}`;
const ZERO = `0x${"0".repeat(64)}`;

// ──────────────────────────────────────────────
// anchorVerdict (REQ-S-12 tri-state) + drift dot
// ──────────────────────────────────────────────

describe("anchorVerdict", () => {
  it("is drift when anchor_status='drift' regardless of versions", () => {
    expect(
      anchorVerdict({ anchorStatus: "drift", anchoredVersion: 2, latestVersion: 2 }),
    ).toBe("drift");
  });

  it("is drift when latestVersion > anchoredVersion (superseded anchor)", () => {
    expect(
      anchorVerdict({ anchorStatus: "confirmed", anchoredVersion: 1, latestVersion: 2 }),
    ).toBe("drift");
  });

  it("is confirmed when the anchored version IS the latest", () => {
    expect(
      anchorVerdict({ anchorStatus: "confirmed", anchoredVersion: 3, latestVersion: 3 }),
    ).toBe("confirmed");
  });

  it("is pending for a first publish awaiting its anchor (anchoredVersion null)", () => {
    expect(
      anchorVerdict({ anchorStatus: "pending", anchoredVersion: null, latestVersion: 1 }),
    ).toBe("pending");
  });

  it("is pending for submitted anchors", () => {
    expect(
      anchorVerdict({ anchorStatus: "submitted", anchoredVersion: null, latestVersion: 1 }),
    ).toBe("pending");
  });

  it("is pending (never green) with no verification data at all", () => {
    expect(anchorVerdict(null)).toBe("pending");
    expect(anchorVerdict(undefined)).toBe("pending");
    expect(
      anchorVerdict({ anchorStatus: null, anchoredVersion: null, latestVersion: null }),
    ).toBe("pending");
  });
});

describe("hasDrift (acceptance rule)", () => {
  it("true for latestVersion>anchoredVersion", () => {
    expect(hasDrift({ anchoredVersion: 1, latestVersion: 2, anchorStatus: "pending" })).toBe(true);
  });
  it("true for anchor_status='drift'", () => {
    expect(hasDrift({ anchoredVersion: 2, latestVersion: 2, anchorStatus: "drift" })).toBe(true);
  });
  it("false for a confirmed, up-to-date anchor", () => {
    expect(hasDrift({ anchoredVersion: 2, latestVersion: 2, anchorStatus: "confirmed" })).toBe(
      false,
    );
  });
});

// ──────────────────────────────────────────────
// compareIntegrity
// ──────────────────────────────────────────────

describe("compareIntegrity", () => {
  it("matches identical hashes case-insensitively", () => {
    expect(compareIntegrity(HASH_A, HASH_A)).toBe("match");
    expect(compareIntegrity(HASH_A.toUpperCase().replace("0X", "0x"), HASH_A)).toBe("match");
  });

  it("flags a mismatch between two well-formed non-zero hashes", () => {
    expect(compareIntegrity(HASH_A, HASH_B)).toBe("mismatch");
  });

  it("zero hash on either side is unknown (never a false match)", () => {
    expect(compareIntegrity(ZERO, HASH_A)).toBe("unknown");
    expect(compareIntegrity(HASH_A, ZERO)).toBe("unknown");
    expect(compareIntegrity(ZERO, ZERO)).toBe("unknown");
  });

  it("missing or malformed input is unknown", () => {
    expect(compareIntegrity(null, HASH_A)).toBe("unknown");
    expect(compareIntegrity(HASH_A, undefined)).toBe("unknown");
    expect(compareIntegrity("", HASH_A)).toBe("unknown");
    expect(compareIntegrity("0x1234", HASH_A)).toBe("unknown");
    expect(compareIntegrity(HASH_A, "not-a-hash")).toBe("unknown");
  });
});

// ──────────────────────────────────────────────
// validateOverridesDoc
// ──────────────────────────────────────────────

describe("validateOverridesDoc", () => {
  it("accepts a plain JSON object", () => {
    const result = validateOverridesDoc('{"description":"new copy"}');
    expect(result).toEqual({ ok: true, doc: { description: "new copy" } });
  });

  it("accepts mutable tagit fields", () => {
    const result = validateOverridesDoc('{"tagit":{"brand":"ACME"}}');
    expect(result.ok).toBe(true);
  });

  it("rejects invalid JSON", () => {
    const result = validateOverridesDoc("{nope");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Invalid JSON/);
  });

  it("rejects arrays, scalars and null", () => {
    for (const text of ["[]", "42", '"str"', "null", "true"]) {
      const result = validateOverridesDoc(text);
      expect(result.ok, text).toBe(false);
    }
  });

  it("rejects a non-object tagit block", () => {
    const result = validateOverridesDoc('{"tagit":[1]}');
    expect(result.ok).toBe(false);
  });

  it("rejects every immutable tagit identity field", () => {
    for (const field of ["tokenId", "chainId", "contract", "tagHash", "serial", "gtin"]) {
      const result = validateOverridesDoc(`{"tagit":{"${field}":"x"}}`);
      expect(result.ok, field).toBe(false);
      if (!result.ok) expect(result.error).toContain(`tagit.${field}`);
    }
  });
});

// ──────────────────────────────────────────────
// registryRowFromAdminItem (admin catalog list item → row, WB-04)
// ──────────────────────────────────────────────

describe("registryRowFromAdminItem", () => {
  /** GET /api/v1/admin/catalog item — services admin-list.ts CatalogListItem. */
  const fullItem = {
    tokenId: "7",
    name: "Sun Chip #7",
    templateId: "tpl_sun",
    templateVersion: 2,
    serial: "SN-0007",
    lifecycle: "bound",
    bound: true,
    visibility: "public",
    saleState: "listed",
    priceUsdc6: "19990000",
    priceDisplay: "$19.99",
    anchorStatus: "confirmed",
    latestVersion: 2,
    anchoredVersion: 2,
    heroMediaSha: "ab".repeat(32),
    drift: false,
    needsProductInfo: false,
    updatedAt: "2026-08-01T00:00:00.000Z",
  };

  it("maps a full admin list item", () => {
    const row = registryRowFromAdminItem(fullItem);
    expect(row).toMatchObject({
      tokenId: "7",
      restricted: false,
      name: "Sun Chip #7",
      templateId: "tpl_sun",
      templateVersion: 2,
      serial: "SN-0007",
      lifecycle: "bound",
      bound: true,
      priceDisplay: "$19.99",
      saleState: "listed",
      verdict: "confirmed",
      hasProductInfo: true,
    });
    expect(row.verification).toMatchObject({
      anchoredVersion: 2,
      latestVersion: 2,
      anchorStatus: "confirmed",
    });
  });

  it("recomputes the drift verdict client-side (latestVersion > anchoredVersion)", () => {
    const row = registryRowFromAdminItem({ ...fullItem, latestVersion: 3, drift: true });
    expect(row.verdict).toBe("drift");
  });

  it("recomputes drift from anchorStatus='drift' too", () => {
    const row = registryRowFromAdminItem({ ...fullItem, anchorStatus: "drift", drift: true });
    expect(row.verdict).toBe("drift");
  });

  it("keeps restricted items VISIBLE with a restricted marker (admin view)", () => {
    const row = registryRowFromAdminItem({ ...fullItem, visibility: "restricted" });
    expect(row.restricted).toBe(true);
    expect(row.name).toBe("Sun Chip #7"); // admin sees the data
  });

  it("maps an unanchored item to a pending verdict (never green)", () => {
    const row = registryRowFromAdminItem({
      ...fullItem,
      anchorStatus: "pending",
      latestVersion: 1,
      anchoredVersion: null,
    });
    expect(row.verdict).toBe("pending");
  });

  it("degrades a malformed entry to a minimal pending row", () => {
    const row = registryRowFromAdminItem(null);
    expect(row).toMatchObject({
      tokenId: "",
      restricted: false,
      name: null,
      templateId: null,
      serial: null,
      lifecycle: null,
      bound: false,
      verdict: "pending",
    });
  });

  it("maps needsProductInfo onto the needs-product-info filter", () => {
    const bare = registryRowFromAdminItem({
      ...fullItem,
      name: null,
      needsProductInfo: true,
    });
    expect(bare.hasProductInfo).toBe(false);
    expect(needsProductInfo(bare)).toBe(true);
    expect(needsProductInfo(registryRowFromAdminItem(fullItem))).toBe(false);
  });
});

// ──────────────────────────────────────────────
// URL filters
// ──────────────────────────────────────────────

function rowWith(patch: Partial<RegistryRow>): RegistryRow {
  return {
    tokenId: "1",
    restricted: false,
    name: "Item",
    templateId: "tpl_1",
    templateVersion: 1,
    serial: null,
    lifecycle: "bound",
    bound: true,
    priceDisplay: null,
    saleState: null,
    verification: null,
    verdict: "confirmed",
    hasProductInfo: true,
    ...patch,
  };
}

describe("parseRegistryFilters", () => {
  it("parses lifecycle, needsInfo and drift params", () => {
    expect(parseRegistryFilters({ lifecycle: "minted", needsInfo: "1", drift: "1" })).toEqual({
      lifecycle: "minted",
      needsInfo: true,
      drift: true,
    });
  });

  it("defaults to no filters", () => {
    expect(parseRegistryFilters({})).toEqual({
      lifecycle: null,
      needsInfo: false,
      drift: false,
    });
  });

  it("ignores malformed lifecycle values", () => {
    for (const lifecycle of ["BOUND", "activated", "3", "", "x"]) {
      expect(parseRegistryFilters({ lifecycle }).lifecycle, lifecycle).toBeNull();
    }
  });

  it("takes the first value of repeated params", () => {
    expect(parseRegistryFilters({ lifecycle: ["draft", "bound"] }).lifecycle).toBe("draft");
  });
});

describe("applyRegistryFilters", () => {
  const rows = [
    rowWith({ tokenId: "1", lifecycle: "bound", verdict: "confirmed" }),
    rowWith({ tokenId: "2", lifecycle: "anchored", verdict: "drift" }),
    rowWith({ tokenId: "3", lifecycle: "anchored", hasProductInfo: false, verdict: "pending" }),
    rowWith({ tokenId: "4", restricted: true, lifecycle: "minted" }),
  ];

  it("passes everything through with no filters", () => {
    expect(
      applyRegistryFilters(rows, { lifecycle: null, needsInfo: false, drift: false }),
    ).toHaveLength(4);
  });

  it("filters by catalog lifecycle", () => {
    const out = applyRegistryFilters(rows, {
      lifecycle: "anchored",
      needsInfo: false,
      drift: false,
    });
    expect(out.map((r) => r.tokenId)).toEqual(["2", "3"]);
  });

  it("filters by needs-product-info", () => {
    const out = applyRegistryFilters(rows, { lifecycle: null, needsInfo: true, drift: false });
    expect(out.map((r) => r.tokenId)).toEqual(["3"]);
  });

  it("filters by drift verdict", () => {
    const out = applyRegistryFilters(rows, { lifecycle: null, needsInfo: false, drift: true });
    expect(out.map((r) => r.tokenId)).toEqual(["2"]);
  });

  it("ANDs filters together", () => {
    const out = applyRegistryFilters(rows, { lifecycle: "anchored", needsInfo: true, drift: true });
    expect(out).toHaveLength(0);
  });
});

describe("registryHref", () => {
  it("omits defaults entirely", () => {
    expect(registryHref({ lifecycle: null, needsInfo: false, drift: false })).toBe("/assets");
  });

  it("encodes active filters", () => {
    expect(registryHref({ lifecycle: "minted", needsInfo: true, drift: true })).toBe(
      "/assets?lifecycle=minted&needsInfo=1&drift=1",
    );
  });

  it("appends a valid keyset cursor and rejects a malformed one", () => {
    const filters = { lifecycle: null, needsInfo: false, drift: false } as const;
    expect(registryHref(filters, "42")).toBe("/assets?cursor=42");
    expect(registryHref(filters, null)).toBe("/assets");
    expect(registryHref(filters, "abc")).toBe("/assets");
  });

  it("round-trips through parseRegistryFilters", () => {
    const filters = { lifecycle: "bound" as const, needsInfo: true, drift: false };
    const href = registryHref(filters);
    const qs = Object.fromEntries(new URL(`http://x${href}`).searchParams.entries());
    expect(parseRegistryFilters(qs)).toEqual(filters);
  });
});
