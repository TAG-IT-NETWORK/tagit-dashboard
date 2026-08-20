import { describe, it, expect } from "vitest";
import {
  anchorVerdict,
  applyRegistryFilters,
  buildRegistryRow,
  compareIntegrity,
  hasDrift,
  needsProductInfo,
  parseRegistryFilters,
  registryHref,
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
// buildRegistryRow (detail DTO → row)
// ──────────────────────────────────────────────

describe("buildRegistryRow", () => {
  const fullDetail = {
    tokenId: "7",
    stateCode: 2,
    lifecycleState: "BOUND",
    name: "Sun Chip #7",
    image: "https://cdn.example/hero.webp",
    tagHash: HASH_A,
    product: { name: "Sun Chip #7", brand: "TAG IT", sku: "SUN-7" },
    price: { priceUsdc6: "19990000", display: "19.99 USDC", saleState: "listed" },
    verification: {
      anchoredVersion: 2,
      latestVersion: 2,
      anchorStatus: "confirmed",
      metadataHash: HASH_A,
      verified: true,
    },
  };

  it("maps a full public detail body", () => {
    const row = buildRegistryRow("7", fullDetail);
    expect(row).toMatchObject({
      tokenId: "7",
      restricted: false,
      name: "Sun Chip #7",
      image: "https://cdn.example/hero.webp",
      stateCode: 2,
      bound: true,
      priceDisplay: "19.99 USDC",
      saleState: "listed",
      verdict: "confirmed",
      hasProductInfo: true,
    });
    expect(row.verification?.metadataHash).toBe(HASH_A);
  });

  it("derives a drift verdict from the verification block", () => {
    const row = buildRegistryRow("7", {
      ...fullDetail,
      verification: { ...fullDetail.verification, latestVersion: 3 },
    });
    expect(row.verdict).toBe("drift");
  });

  it("treats a zero tagHash as unbound", () => {
    const row = buildRegistryRow("7", { ...fullDetail, tagHash: ZERO });
    expect(row.bound).toBe(false);
  });

  it("marks restricted stubs and hides their placeholder branding", () => {
    const row = buildRegistryRow("9", {
      tokenId: "9",
      restricted: true,
      name: "TAG IT Protected Asset",
      image: "https://cdn.example/logo.png",
      verification: { status: "protected" },
    });
    expect(row.restricted).toBe(true);
    expect(row.name).toBeNull();
    expect(row.image).toBeNull();
    expect(row.verdict).toBe("pending");
  });

  it("degrades a failed/missing detail body to a minimal pending row", () => {
    const row = buildRegistryRow("11", null);
    expect(row).toMatchObject({
      tokenId: "11",
      restricted: false,
      name: null,
      bound: false,
      verdict: "pending",
      hasProductInfo: false,
    });
  });

  it("detects missing product info (needs-product-info)", () => {
    const bare = buildRegistryRow("12", {
      tokenId: "12",
      stateCode: 1,
      lifecycleState: "MINTED",
    });
    expect(bare.hasProductInfo).toBe(false);
    expect(needsProductInfo(bare)).toBe(true);
    expect(needsProductInfo(buildRegistryRow("7", fullDetail))).toBe(false);
    // Restricted rows are unknowable — never counted as needing info.
    expect(needsProductInfo({ restricted: true, hasProductInfo: false })).toBe(false);
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
    image: null,
    stateCode: 2,
    lifecycleState: "BOUND",
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
  it("parses state, needsInfo and drift params", () => {
    expect(parseRegistryFilters({ state: "3", needsInfo: "1", drift: "1" })).toEqual({
      state: 3,
      needsInfo: true,
      drift: true,
    });
  });

  it("defaults to no filters", () => {
    expect(parseRegistryFilters({})).toEqual({ state: null, needsInfo: false, drift: false });
  });

  it("ignores malformed state values", () => {
    for (const state of ["7", "-1", "abc", "2.5", ""]) {
      expect(parseRegistryFilters({ state }).state, state).toBeNull();
    }
  });

  it("takes the first value of repeated params", () => {
    expect(parseRegistryFilters({ state: ["4", "5"] }).state).toBe(4);
  });
});

describe("applyRegistryFilters", () => {
  const rows = [
    rowWith({ tokenId: "1", stateCode: 2, verdict: "confirmed" }),
    rowWith({ tokenId: "2", stateCode: 3, verdict: "drift" }),
    rowWith({ tokenId: "3", stateCode: 3, hasProductInfo: false, verdict: "pending" }),
    rowWith({ tokenId: "4", restricted: true, stateCode: null, hasProductInfo: false }),
  ];

  it("passes everything through with no filters", () => {
    expect(
      applyRegistryFilters(rows, { state: null, needsInfo: false, drift: false }),
    ).toHaveLength(4);
  });

  it("filters by lifecycle state code", () => {
    const out = applyRegistryFilters(rows, { state: 3, needsInfo: false, drift: false });
    expect(out.map((r) => r.tokenId)).toEqual(["2", "3"]);
  });

  it("filters by needs-product-info (restricted rows excluded)", () => {
    const out = applyRegistryFilters(rows, { state: null, needsInfo: true, drift: false });
    expect(out.map((r) => r.tokenId)).toEqual(["3"]);
  });

  it("filters by drift verdict", () => {
    const out = applyRegistryFilters(rows, { state: null, needsInfo: false, drift: true });
    expect(out.map((r) => r.tokenId)).toEqual(["2"]);
  });

  it("ANDs filters together", () => {
    const out = applyRegistryFilters(rows, { state: 3, needsInfo: true, drift: true });
    expect(out).toHaveLength(0);
  });
});

describe("registryHref", () => {
  it("omits defaults entirely", () => {
    expect(registryHref({ state: null, needsInfo: false, drift: false })).toBe("/assets");
  });

  it("encodes active filters", () => {
    expect(registryHref({ state: 5, needsInfo: true, drift: true })).toBe(
      "/assets?state=5&needsInfo=1&drift=1",
    );
  });

  it("round-trips through parseRegistryFilters", () => {
    const filters = { state: 2, needsInfo: true, drift: false };
    const href = registryHref(filters);
    const qs = Object.fromEntries(new URL(`http://x${href}`).searchParams.entries());
    expect(parseRegistryFilters(qs)).toEqual(filters);
  });
});
