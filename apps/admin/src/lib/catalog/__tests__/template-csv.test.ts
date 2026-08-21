import { describe, expect, it } from "vitest";

import { ITEMS_CSV_HEADER, buildItemsCsv, csvEscapeCell } from "@/lib/catalog/template-csv";
import type { TemplateItemRow } from "@/lib/catalog/template-types";

function makeRow(overrides: Partial<TemplateItemRow> = {}): TemplateItemRow {
  return {
    tokenId: "42",
    found: true,
    restricted: false,
    name: "PDRN Capsule Cream",
    image: null,
    lifecycleState: "CLAIMED",
    sku: "CW2288-111",
    anchoredVersion: 2,
    latestVersion: 2,
    anchorStatus: "confirmed",
    ...overrides,
  };
}

describe("csvEscapeCell", () => {
  it("passes plain values through", () => {
    expect(csvEscapeCell("hello")).toBe("hello");
    expect(csvEscapeCell(42)).toBe("42");
    expect(csvEscapeCell(null)).toBe("");
    expect(csvEscapeCell(undefined)).toBe("");
  });

  it("neutralizes formula-leading cells (spreadsheet injection)", () => {
    // Quote chars additionally trigger RFC-4180 wrapping after neutralization.
    expect(csvEscapeCell("=HYPERLINK(\"http://evil\")")).toBe("\"'=HYPERLINK(\"\"http://evil\"\")\"");
    expect(csvEscapeCell("+1")).toBe("'+1");
    expect(csvEscapeCell("-1")).toBe("'-1");
    expect(csvEscapeCell("@cmd")).toBe("'@cmd");
  });

  it("quotes cells containing commas, quotes or newlines (RFC 4180)", () => {
    expect(csvEscapeCell("a,b")).toBe('"a,b"');
    expect(csvEscapeCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscapeCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("handles a hostile name combining both", () => {
    expect(csvEscapeCell('=1+1,"x"')).toBe('"\'=1+1,""x"""');
  });
});

describe("buildItemsCsv", () => {
  it("emits header + one CRLF-joined line per row", () => {
    const csv = buildItemsCsv([makeRow(), makeRow({ tokenId: "43", name: null })], "https://verify.tagit.network");
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(ITEMS_CSV_HEADER.join(","));
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain("42");
    expect(lines[1]).toContain("https://verify.tagit.network/asset/42");
    expect(lines[2].startsWith("43,,")).toBe(true);
  });

  it("keeps hostile item names inert", () => {
    const csv = buildItemsCsv([makeRow({ name: "=SUM(A1:A9)" })], "https://verify.tagit.network");
    expect(csv).toContain("'=SUM(A1:A9)");
  });
});
