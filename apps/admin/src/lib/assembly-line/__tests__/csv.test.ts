import { describe, it, expect } from "vitest";
import { buildResultsCsv } from "../csv";

describe("buildResultsCsv", () => {
  it("builds a header-only CSV for an empty result set", () => {
    expect(buildResultsCsv([])).toBe("UID,Token ID,Tag ID");
  });

  it("builds one row per result, tokenId rendered as a decimal string (not scientific notation)", () => {
    const csv = buildResultsCsv([
      { uid: "04:A1:B2:C3:D4:E5:F6", tokenId: 101n, tagId: "0xabc123" },
      { uid: "04:11:22:33:44:55:66", tokenId: 102n, tagId: "0xdef456" },
    ]);
    expect(csv).toBe(
      [
        "UID,Token ID,Tag ID",
        "04:A1:B2:C3:D4:E5:F6,101,0xabc123",
        "04:11:22:33:44:55:66,102,0xdef456",
      ].join("\n"),
    );
  });

  it("renders large bigint tokenIds losslessly", () => {
    const csv = buildResultsCsv([
      { uid: "04:A1:B2:C3:D4:E5:F6", tokenId: 9007199254740993n, tagId: "0xabc" },
    ]);
    expect(csv).toContain("9007199254740993");
  });
});
