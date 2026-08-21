import { describe, expect, it } from "vitest";

import {
  MAX_TOKEN_IDS,
  buildJsonDiff,
  canMutateCatalog,
  canPublishCatalog,
  computePublishState,
  deepJsonEqual,
  diffHasChanges,
  formatMsrpDisplay,
  formatUsdc6Display,
  mediaListFromAttributes,
  mergeMediaIntoAttributes,
  parseTokenIdInput,
  templateStatusStyle,
  templateThumbUrl,
  usdc6ToDecimalInput,
  workingCopySnapshot,
} from "@/lib/catalog/template-logic";
import type { TemplateDto, TemplateVersionDto } from "@/lib/catalog/template-types";

function makeTemplate(overrides: Partial<TemplateDto> = {}): TemplateDto {
  return {
    id: "tpl_01ABC",
    slug: "pdrn-cream-01abc",
    status: "draft",
    version: 0,
    name: "PDRN Capsule Cream",
    brand: "TAG IT",
    model: "PDRN-100",
    sku: "CW2288-111",
    category: "cosmetics",
    origin: "Seoul",
    description: "A cream",
    attributes: [{ trait_type: "Volume", value: "100ml" }],
    priceUsdc6: "22500000",
    msrpAmount: 2500,
    msrpCurrency: "USD",
    businessId: null,
    createdBy: "tester",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function versionOf(t: TemplateDto, version: number): TemplateVersionDto {
  return {
    version,
    snapshot: workingCopySnapshot(t),
    publishedBy: "tester",
    publishedAt: "2026-08-02T00:00:00.000Z",
  };
}

describe("canMutateCatalog", () => {
  it("allows editors and admins, blocks viewers", () => {
    expect(canMutateCatalog("viewer")).toBe(false);
    expect(canMutateCatalog("editor")).toBe(true);
    expect(canMutateCatalog("admin")).toBe(true);
  });

  it("post-T32: null role (unauthenticated / not enrolled) fails closed", () => {
    expect(canMutateCatalog(null)).toBe(false);
  });
});

describe("canPublishCatalog", () => {
  it("admin only", () => {
    expect(canPublishCatalog("admin")).toBe(true);
    expect(canPublishCatalog("editor")).toBe(false);
    expect(canPublishCatalog("viewer")).toBe(false);
    expect(canPublishCatalog(null)).toBe(false);
  });
});

describe("templateStatusStyle", () => {
  it("maps the three services statuses", () => {
    expect(templateStatusStyle("draft").label).toBe("Draft");
    expect(templateStatusStyle("published").label).toBe("Published");
    expect(templateStatusStyle("archived").label).toBe("Archived");
  });

  it("passes unknown statuses through as their own label", () => {
    expect(templateStatusStyle("weird").label).toBe("weird");
  });
});

describe("formatUsdc6Display", () => {
  it("formats minor units with half-up cent rounding (mirror of services)", () => {
    expect(formatUsdc6Display("22500000")).toBe("$22.50");
    expect(formatUsdc6Display("0")).toBe("$0.00");
    expect(formatUsdc6Display("1")).toBe("$0.00"); // 0.000001 → rounds down
    expect(formatUsdc6Display("5000")).toBe("$0.01"); // half rounds up
    expect(formatUsdc6Display("4999")).toBe("$0.00");
    expect(formatUsdc6Display("19990000")).toBe("$19.99");
  });

  it("rejects null and malformed strings", () => {
    expect(formatUsdc6Display(null)).toBeNull();
    expect(formatUsdc6Display(undefined)).toBeNull();
    expect(formatUsdc6Display("12.5")).toBeNull();
    expect(formatUsdc6Display("-1")).toBeNull();
    expect(formatUsdc6Display("")).toBeNull();
  });
});

describe("usdc6ToDecimalInput", () => {
  it("round-trips minor units to the input decimal format", () => {
    expect(usdc6ToDecimalInput("22500000")).toBe("22.5");
    expect(usdc6ToDecimalInput("22000000")).toBe("22");
    expect(usdc6ToDecimalInput("1")).toBe("0.000001");
    expect(usdc6ToDecimalInput("0")).toBe("0");
  });

  it("returns empty string for null/malformed", () => {
    expect(usdc6ToDecimalInput(null)).toBe("");
    expect(usdc6ToDecimalInput("x")).toBe("");
  });
});

describe("formatMsrpDisplay", () => {
  it("uses the per-currency exponent", () => {
    expect(formatMsrpDisplay(2500, "USD")).toBe("25.00 USD");
    expect(formatMsrpDisplay(2500, "JPY")).toBe("2500 JPY");
    expect(formatMsrpDisplay(2500, "KWD")).toBe("2.500 KWD");
  });

  it("returns null for unset or unsupported values", () => {
    expect(formatMsrpDisplay(null, "USD")).toBeNull();
    expect(formatMsrpDisplay(2500, null)).toBeNull();
    expect(formatMsrpDisplay(2500, "XXX")).toBeNull();
    expect(formatMsrpDisplay(-1, "USD")).toBeNull();
    expect(formatMsrpDisplay(2.5, "USD")).toBeNull();
  });
});

describe("deepJsonEqual", () => {
  it("compares nested structures by value", () => {
    expect(deepJsonEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(deepJsonEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(deepJsonEqual([1, 2], [2, 1])).toBe(false);
    expect(deepJsonEqual(null, null)).toBe(true);
    expect(deepJsonEqual({ a: undefined }, {})).toBe(false); // key presence matters
  });
});

describe("computePublishState", () => {
  it("never published → version 0, no drift signals", () => {
    const t = makeTemplate();
    expect(computePublishState(t, [])).toEqual({
      latestVersion: 0,
      workingDirty: false,
      itemsDrift: "none",
    });
  });

  it("clean working copy on v1 → info-level items note, not dirty", () => {
    const t = makeTemplate({ status: "published", version: 1 });
    const state = computePublishState(t, [versionOf(t, 1)]);
    expect(state.latestVersion).toBe(1);
    expect(state.workingDirty).toBe(false);
    expect(state.itemsDrift).toBe("info");
  });

  it("edited working copy after publish → workingDirty (fork drift)", () => {
    const published = makeTemplate({ status: "published", version: 1 });
    const edited = { ...published, name: "PDRN Capsule Cream v2" };
    const state = computePublishState(edited, [versionOf(published, 1)]);
    expect(state.workingDirty).toBe(true);
  });

  it("republish (v2) → items flagged behind until propagate", () => {
    const t = makeTemplate({ status: "published", version: 2 });
    const state = computePublishState(t, [versionOf(t, 1), versionOf(t, 2)]);
    expect(state.latestVersion).toBe(2);
    expect(state.itemsDrift).toBe("behind");
  });

  it("uses the HIGHEST version even when the list is descending (services order)", () => {
    const t = makeTemplate({ status: "published", version: 3 });
    const versions = [versionOf(t, 3), versionOf(t, 2), versionOf(t, 1)];
    expect(computePublishState(t, versions).latestVersion).toBe(3);
  });
});

describe("parseTokenIdInput", () => {
  it("parses ids separated by commas, whitespace and semicolons", () => {
    expect(parseTokenIdInput("1, 2\n3;4\t5").ids).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("expands inclusive ranges", () => {
    const { ids, errors } = parseTokenIdInput("10-13");
    expect(ids).toEqual(["10", "11", "12", "13"]);
    expect(errors).toEqual([]);
  });

  it("dedupes and normalizes leading zeros", () => {
    const { ids } = parseTokenIdInput("007 7 8 008");
    expect(ids).toEqual(["7", "8"]);
  });

  it("reports malformed chunks and inverted ranges without throwing", () => {
    const { ids, errors } = parseTokenIdInput("5 abc 9-7 0x12");
    expect(ids).toEqual(["5"]);
    expect(errors).toHaveLength(3);
  });

  it("caps the total at the services MAX_TOKEN_IDS", () => {
    const { ids, errors } = parseTokenIdInput(`1-${MAX_TOKEN_IDS + 5}`);
    expect(ids).toHaveLength(0);
    expect(errors.some((e) => e.includes("range spans"))).toBe(true);
    const flat = parseTokenIdInput(
      Array.from({ length: MAX_TOKEN_IDS + 3 }, (_, i) => String(i + 1)).join(" "),
    );
    expect(flat.ids).toHaveLength(MAX_TOKEN_IDS);
    expect(flat.errors.some((e) => e.includes("truncated"))).toBe(true);
  });

  it("handles empty input", () => {
    expect(parseTokenIdInput("  \n ")).toEqual({ ids: [], errors: [] });
  });
});

describe("buildJsonDiff", () => {
  it("identical values → all-same lines", () => {
    const diff = buildJsonDiff({ a: 1 }, { a: 1 });
    expect(diffHasChanges(diff)).toBe(false);
    expect(diff.every((l) => l.type === "same")).toBe(true);
  });

  it("changed scalar → paired del/add lines with context preserved", () => {
    const diff = buildJsonDiff({ name: "old", sku: "S1" }, { name: "new", sku: "S1" });
    expect(diffHasChanges(diff)).toBe(true);
    const dels = diff.filter((l) => l.type === "del").map((l) => l.left);
    const adds = diff.filter((l) => l.type === "add").map((l) => l.right);
    expect(dels).toEqual(['  "name": "old",']);
    expect(adds).toEqual(['  "name": "new",']);
    expect(diff.filter((l) => l.type === "same").length).toBeGreaterThan(0);
  });

  it("added key shows as add-only", () => {
    const diff = buildJsonDiff({ a: 1 }, { a: 1, b: 2 });
    expect(diff.filter((l) => l.type === "del")).toHaveLength(1); // '"a": 1' loses its comma
    expect(diff.filter((l) => l.type === "add")).toHaveLength(2);
  });

  it("key order does not create phantom diffs (stable stringify)", () => {
    const diff = buildJsonDiff({ a: 1, b: 2 }, { b: 2, a: 1 });
    expect(diffHasChanges(diff)).toBe(false);
  });
});

describe("template media attributes", () => {
  it("round-trips media through attribute rows, hero first", () => {
    const merged = mergeMediaIntoAttributes(
      [{ trait_type: "Volume", value: "100ml" }],
      [
        { role: "gallery", url: "https://media.tagit.network/i/bb/lg.webp" },
        { role: "hero", url: "https://media.tagit.network/i/aa/lg.webp" },
      ],
    );
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;
    expect(merged.attributes).toEqual([
      { trait_type: "Volume", value: "100ml" },
      { trait_type: "media:hero", value: "https://media.tagit.network/i/aa/lg.webp" },
      { trait_type: "media:gallery", value: "https://media.tagit.network/i/bb/lg.webp" },
    ]);
    expect(mediaListFromAttributes(merged.attributes)).toEqual([
      { role: "hero", url: "https://media.tagit.network/i/aa/lg.webp" },
      { role: "gallery", url: "https://media.tagit.network/i/bb/lg.webp" },
    ]);
  });

  it("replaces existing media rows instead of appending duplicates", () => {
    const merged = mergeMediaIntoAttributes(
      [
        { trait_type: "media:hero", value: "https://old.example/x.webp" },
        { trait_type: "Volume", value: "100ml" },
      ],
      [{ role: "hero", url: "https://media.tagit.network/i/cc/lg.webp" }],
    );
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;
    expect(merged.attributes.filter((a) => a.trait_type === "media:hero")).toHaveLength(1);
    expect(merged.attributes[0]).toEqual({ trait_type: "Volume", value: "100ml" });
  });

  it("enforces the services value-length and row-count caps", () => {
    const tooLong = mergeMediaIntoAttributes([], [{ role: "hero", url: "x".repeat(201) }]);
    expect(tooLong.ok).toBe(false);
    const full = Array.from({ length: 64 }, (_, i) => ({
      trait_type: `k${i}`,
      value: "v",
    }));
    const overflow = mergeMediaIntoAttributes(full, [
      { role: "hero", url: "https://media.tagit.network/i/dd/lg.webp" },
    ]);
    expect(overflow.ok).toBe(false);
  });

  it("templateThumbUrl prefers the hero", () => {
    expect(
      templateThumbUrl([
        { trait_type: "media:gallery", value: "https://g.example/1.webp" },
        { trait_type: "media:hero", value: "https://h.example/1.webp" },
      ]),
    ).toBe("https://h.example/1.webp");
    expect(templateThumbUrl([{ trait_type: "media:gallery", value: "https://g.example/1.webp" }])).toBe(
      "https://g.example/1.webp",
    );
    expect(templateThumbUrl([{ trait_type: "Volume", value: "100ml" }])).toBeNull();
    expect(templateThumbUrl(null)).toBeNull();
  });
});
