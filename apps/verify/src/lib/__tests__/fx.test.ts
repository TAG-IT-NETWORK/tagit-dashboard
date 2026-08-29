import { describe, it, expect } from "vitest";
import { currencyFractionDigits, formatFxApprox } from "../fx";

/**
 * META-T37 acceptance suite for the fx approximation renderer.
 *
 * THE INVARIANT (pinned by the "never exceeds" block below, which parses the
 * RENDERED strings): no rendered fx price ever carries more fraction digits
 * than its currency's minor unit allows. The renderer guarantees it by
 * refusing (null) rather than by re-formatting — `approx` arrives with the
 * exponent already applied and must be shown verbatim or not at all.
 */

describe("currencyFractionDigits", () => {
  it("resolves the ISO minor-unit exponent", () => {
    expect(currencyFractionDigits("EUR")).toBe(2);
    expect(currencyFractionDigits("USD")).toBe(2);
    expect(currencyFractionDigits("JPY")).toBe(0);
    expect(currencyFractionDigits("KWD")).toBe(3);
  });

  it("null for malformed codes — precision cannot be verified", () => {
    expect(currencyFractionDigits("")).toBeNull();
    expect(currencyFractionDigits("E")).toBeNull();
    expect(currencyFractionDigits("EURO")).toBeNull();
    expect(currencyFractionDigits("€")).toBeNull();
  });
});

describe("formatFxApprox — rendering", () => {
  it("renders '≈ €xx.xx' verbatim from the pre-formatted approx string", () => {
    const render = formatFxApprox({ currency: "EUR", approx: "66.54" });
    expect(render).not.toBeNull();
    expect(render!.text).toBe("≈ €66.54");
  });

  it("renders zero-decimal currencies with no fraction part (JPY as-is)", () => {
    const render = formatFxApprox({ currency: "JPY", approx: "12366" });
    expect(render).not.toBeNull();
    // Exactly the server's digits: no grouping ("12,366"), no invented ".00".
    expect(render!.text).toBe("≈ ¥12366");
  });

  it("never re-formats: trailing zeros and shorter fractions survive untouched", () => {
    expect(formatFxApprox({ currency: "EUR", approx: "0.50" })!.text).toBe("≈ €0.50");
    expect(formatFxApprox({ currency: "EUR", approx: "66.5" })!.text).toBe("≈ €66.5");
  });

  it("carries the explicit approximate marker in text AND an aria-label", () => {
    const render = formatFxApprox({ currency: "EUR", approx: "66.54" })!;
    expect(render.text.startsWith("≈ ")).toBe(true);
    expect(render.ariaLabel).toContain("Approximately 66.54 EUR");
    expect(render.ariaLabel.toLowerCase()).toContain("approximate");
  });

  it("returns null for an absent block", () => {
    expect(formatFxApprox(undefined)).toBeNull();
    expect(formatFxApprox(null)).toBeNull();
  });

  it("refuses non-decimal approx strings", () => {
    for (const approx of ["", "-66.54", "+66.54", "66,54", "1e3", "66.", ".5", "66.54 EUR", "NaN"]) {
      expect(formatFxApprox({ currency: "EUR", approx })).toBeNull();
    }
  });

  it("refuses unverifiable currency codes", () => {
    expect(formatFxApprox({ currency: "EURO", approx: "66.54" })).toBeNull();
    expect(formatFxApprox({ currency: "", approx: "66.54" })).toBeNull();
  });

  it("refuses approx strings that exceed the currency's exponent instead of truncating", () => {
    expect(formatFxApprox({ currency: "EUR", approx: "66.5432" })).toBeNull();
    expect(formatFxApprox({ currency: "JPY", approx: "123.45" })).toBeNull();
    expect(formatFxApprox({ currency: "KWD", approx: "1.2345" })).toBeNull();
  });
});

describe("formatFxApprox — rendered price NEVER exceeds the currency's fraction digits", () => {
  // Valid server-shaped fx blocks across 0-, 2- and 3-exponent currencies,
  // plus edge shapes (trailing zeros, single fraction digit, integer EUR).
  const fixtures = [
    { currency: "EUR", approx: "66.54" },
    { currency: "EUR", approx: "66.5" },
    { currency: "EUR", approx: "66" },
    { currency: "EUR", approx: "0.50" },
    { currency: "USD", approx: "1299.99" },
    { currency: "GBP", approx: "0.01" },
    { currency: "CHF", approx: "88.00" },
    { currency: "JPY", approx: "12366" },
    { currency: "JPY", approx: "0" },
    { currency: "KWD", approx: "1.234" },
  ] as const;

  it.each(fixtures)("$currency $approx", ({ currency, approx }) => {
    const render = formatFxApprox({ currency, approx });
    expect(render).not.toBeNull();

    // Parse the RENDERED string, not the input: the invariant is about what
    // a reader sees. Exactly one numeric run must be present.
    const matches = render!.text.match(/\d+(?:\.\d+)?/g) ?? [];
    expect(matches).toHaveLength(1);
    const fraction = matches[0]?.split(".")[1] ?? "";

    const maxDigits = currencyFractionDigits(currency);
    expect(maxDigits).not.toBeNull();
    expect(fraction.length).toBeLessThanOrEqual(maxDigits!);
  });

  it("and the invariant holds by refusal for over-precise inputs, not by rounding", () => {
    // If the renderer ever "fixed" these with toFixed, they would render with
    // legal precision but wrong digits. Refusal is the only correct output.
    expect(formatFxApprox({ currency: "JPY", approx: "12366.4" })).toBeNull();
    expect(formatFxApprox({ currency: "USD", approx: "10.999" })).toBeNull();
  });
});
