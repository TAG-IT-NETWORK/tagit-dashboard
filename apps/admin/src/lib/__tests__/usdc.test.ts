import { describe, it, expect } from "vitest";
import { isValidUsdcString, usdcStringToUnits, USDC_STRING_RE } from "../usdc";

// Mirror of tagit-services src/lib/currency.ts parseUsdcString. The regex must
// stay byte-identical to the server's: /^(0|[1-9]\d{0,11})(\.\d{1,6})?$/
describe("USDC_STRING_RE mirrors the server regex", () => {
  it("is byte-identical to the server's USDC_STRING_RE", () => {
    expect(USDC_STRING_RE.source).toBe("^(0|[1-9]\\d{0,11})(\\.\\d{1,6})?$");
  });
});

describe("isValidUsdcString", () => {
  it("accepts what the server accepts", () => {
    for (const s of ["0", "1", "22", "19.99", "0.000001", "199.990000", "999999999999", "0.5"]) {
      expect(isValidUsdcString(s), s).toBe(true);
    }
  });

  it("rejects more than 6 decimals", () => {
    expect(isValidUsdcString("1.0000001")).toBe(false);
    expect(isValidUsdcString("0.1234567")).toBe(false);
  });

  it("rejects signs, exponents, leading zeros, empty fraction, non-numeric", () => {
    for (const s of [
      "-1",
      "+1",
      "1e6",
      "01",
      "00.5",
      "1.",
      ".5",
      "",
      " 1",
      "1 ",
      "1,000",
      "$22",
      "abc",
      "1000000000000", // 13 integer digits — over the server's 12-digit cap
    ]) {
      expect(isValidUsdcString(s), JSON.stringify(s)).toBe(false);
    }
  });
});

describe("usdcStringToUnits (mirror of the server's parse result)", () => {
  it("converts to usdc-6 minor units exactly like the server", () => {
    expect(usdcStringToUnits("0")).toBe("0");
    expect(usdcStringToUnits("22")).toBe("22000000");
    expect(usdcStringToUnits("19.99")).toBe("19990000");
    expect(usdcStringToUnits("0.000001")).toBe("1");
  });

  it("returns null for rejected input", () => {
    expect(usdcStringToUnits("1.0000001")).toBeNull();
    expect(usdcStringToUnits("-1")).toBeNull();
  });
});
