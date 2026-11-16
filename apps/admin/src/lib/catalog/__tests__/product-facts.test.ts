import { describe, expect, it } from "vitest";

import {
  EMPTY_BATCH_FACTS_DRAFT,
  FACT_LIMITS,
  describeBatchFacts,
  factsSupported,
  foldFactText,
  hasForbiddenFactChar,
  isCalendarDate,
  mintCategory,
  parseBatchFactsBody,
  readBatchFactsDraft,
  readTemplateFactsDraft,
  takesProductFacts,
  templateFactsDraft,
  type TemplateFactsDraft,
} from "../product-facts";

/**
 * Product facts for shoppers (TAP-T09) — the console's pure logic. It mirrors
 * the rules tagit-services enforces, so a value the form accepts is a value
 * the API accepts. Invisible characters are built from code points so that
 * none has to live in this file.
 */

const RIGHT_TO_LEFT_OVERRIDE = String.fromCharCode(0x202e);
const NUL = String.fromCharCode(0);

const EMPTY: TemplateFactsDraft = {
  size: "",
  ingredients: "",
  howToUse: "",
  warnings: "",
  useWithinMonths: "",
};

describe("takesProductFacts", () => {
  it("is true for cosmetics however it is capitalised or padded", () => {
    for (const category of ["cosmetics", "Cosmetics", "COSMETICS", "  Cosmetics "]) {
      expect(takesProductFacts(category), category).toBe(true);
    }
  });

  it("is false for anything else", () => {
    for (const category of ["apparel", "skincare", "cosmetic", "", null, undefined]) {
      expect(takesProductFacts(category), String(category)).toBe(false);
    }
  });
});

describe("factsSupported", () => {
  it("tells an API that returns the facts key from one that does not know it", () => {
    expect(factsSupported({ facts: null })).toBe(true);
    expect(factsSupported({ facts: { size: "50 ml" } })).toBe(true);
    expect(factsSupported({})).toBe(false);
  });
});

describe("mintCategory", () => {
  const snapshot = (category: unknown) => ({ category });

  it("is the working copy's category for a template that was never published", () => {
    expect(mintCategory({ category: "Cosmetics" }, [])).toBe("Cosmetics");
    expect(mintCategory({ category: null }, [])).toBeNull();
  });

  it("is the latest published snapshot's category once there is one", () => {
    const versions = [
      { version: 1, snapshot: snapshot("apparel") },
      { version: 3, snapshot: snapshot("cosmetics") },
      { version: 2, snapshot: snapshot("watches") },
    ];
    // The working copy has moved on; the next batch still mints from v3.
    expect(mintCategory({ category: "apparel" }, versions)).toBe("cosmetics");
  });

  it("is null when the published snapshot has no usable category", () => {
    expect(
      mintCategory({ category: "cosmetics" }, [{ version: 1, snapshot: snapshot(null) }]),
    ).toBeNull();
    expect(mintCategory({ category: "cosmetics" }, [{ version: 1, snapshot: {} }])).toBeNull();
  });
});

describe("text rules", () => {
  it("folds line breaks, tabs and runs of spaces into single spaces", () => {
    expect(foldFactText("  Aqua,\r\n\tGlycerin,   Niacinamide \n")).toBe(
      "Aqua, Glycerin, Niacinamide",
    );
    expect(foldFactText(" \n ")).toBe("");
  });

  it("spots control and text-direction characters", () => {
    for (const code of [
      0x00, 0x1f, 0x7f, 0x85, 0x9f, 0x2028, 0x2029, 0x202a, 0x202e, 0x2066, 0x2069,
    ]) {
      expect(hasForbiddenFactChar(`a${String.fromCharCode(code)}b`), code.toString(16)).toBe(true);
    }
    for (const fine of [
      "50 ml",
      "Aqua, Glycerin",
      "Crème de nuit",
      "保湿クリーム",
      "50 ml ℮ 1.7 fl oz",
    ]) {
      expect(hasForbiddenFactChar(fine), fine).toBe(false);
    }
  });
});

describe("template facts form", () => {
  it("starts from the stored facts, with empty strings for what is unset", () => {
    expect(templateFactsDraft(null)).toEqual(EMPTY);
    expect(templateFactsDraft(undefined)).toEqual(EMPTY);
    expect(templateFactsDraft({ size: "50 ml", useWithinMonths: 12 })).toEqual({
      ...EMPTY,
      size: "50 ml",
      useWithinMonths: "12",
    });
  });

  it("reads a filled form into the value the API takes", () => {
    const read = readTemplateFactsDraft({
      size: " 50 ml ",
      ingredients: "Aqua,\nGlycerin",
      howToUse: "Apply at night.",
      warnings: "For external use only.",
      useWithinMonths: " 12 ",
    });
    expect(read.errors).toEqual({});
    expect(read.facts).toEqual({
      size: "50 ml",
      ingredients: "Aqua, Glycerin",
      howToUse: "Apply at night.",
      warnings: "For external use only.",
      useWithinMonths: 12,
    });
  });

  it("sends only what is filled in, and null when nothing is", () => {
    expect(readTemplateFactsDraft({ ...EMPTY, size: "50 ml", warnings: "   " })).toEqual({
      facts: { size: "50 ml" },
      errors: {},
    });
    expect(readTemplateFactsDraft(EMPTY)).toEqual({ facts: null, errors: {} });
    expect(readTemplateFactsDraft({ ...EMPTY, ingredients: " \n " })).toEqual({
      facts: null,
      errors: {},
    });
  });

  it("holds each text field to the cap services holds it to", () => {
    const caps = [
      ["size", FACT_LIMITS.size],
      ["ingredients", FACT_LIMITS.ingredients],
      ["howToUse", FACT_LIMITS.howToUse],
      ["warnings", FACT_LIMITS.warnings],
    ] as const;
    for (const [field, max] of caps) {
      expect(readTemplateFactsDraft({ ...EMPTY, [field]: "x".repeat(max) }).errors, field).toEqual(
        {},
      );
      const over = readTemplateFactsDraft({ ...EMPTY, [field]: "x".repeat(max + 1) });
      expect(over.errors[field], field).toMatch(/characters/);
      // A field with an error is not sent.
      expect(over.facts, field).toBeNull();
    }
    // The caps are the ones in tagit-services COSMETICS_FACT_LIMITS.
    expect(FACT_LIMITS).toMatchObject({
      size: 60,
      ingredients: 4000,
      howToUse: 1500,
      warnings: 1500,
    });
  });

  it("counts the cap after folding, as services does", () => {
    const padded = `${"x".repeat(FACT_LIMITS.size)}   \n`;
    expect(readTemplateFactsDraft({ ...EMPTY, size: padded }).errors).toEqual({});
  });

  it("refuses hidden control and text-direction characters", () => {
    for (const bad of [RIGHT_TO_LEFT_OVERRIDE, NUL]) {
      const read = readTemplateFactsDraft({ ...EMPTY, warnings: `Keep${bad}away` });
      expect(read.errors.warnings).toMatch(/hidden control character/);
      expect(read.facts).toBeNull();
    }
  });

  it("takes use-within only as a whole number of months from 1 to 120", () => {
    for (const ok of ["1", "6", "12", "120"]) {
      expect(readTemplateFactsDraft({ ...EMPTY, useWithinMonths: ok }).facts).toEqual({
        useWithinMonths: Number(ok),
      });
    }
    for (const bad of ["0", "121", "1.5", "-6", "twelve", "12 months", "1e2", "9999"]) {
      const read = readTemplateFactsDraft({ ...EMPTY, useWithinMonths: bad });
      expect(read.errors.useWithinMonths, bad).toMatch(/whole number of months/);
      expect(read.facts, bad).toBeNull();
    }
  });
});

describe("batch facts form", () => {
  it("knows a real calendar date from a string that only looks like one", () => {
    for (const ok of ["2026-02-28", "2028-02-29", "2000-01-01", "2100-12-31"]) {
      expect(isCalendarDate(ok), ok).toBe(true);
    }
    for (const bad of [
      "2026-02-30",
      "2027-02-29",
      "2026-13-01",
      "26-06-01",
      "06/01/2026",
      "1999-12-31",
      "2101-01-01",
      "",
    ]) {
      expect(isCalendarDate(bad), bad).toBe(false);
    }
  });

  it("reads a filled form into the value the API takes", () => {
    expect(
      readBatchFactsDraft({ lot: " L2406A ", madeOn: "2026-06-01", bestBefore: "2028-06-01" }),
    ).toEqual({
      facts: { lot: "L2406A", madeOn: "2026-06-01", bestBefore: "2028-06-01" },
      errors: {},
    });
  });

  it("gives null when nothing is filled in", () => {
    expect(readBatchFactsDraft(EMPTY_BATCH_FACTS_DRAFT)).toEqual({ facts: null, errors: {} });
    expect(readBatchFactsDraft({ lot: "  ", madeOn: "", bestBefore: "" })).toEqual({
      facts: null,
      errors: {},
    });
  });

  it("flags a date that is not real, per field", () => {
    const read = readBatchFactsDraft({ lot: "L1", madeOn: "2026-02-30", bestBefore: "soon" });
    expect(read.errors.madeOn).toMatch(/real date/);
    expect(read.errors.bestBefore).toMatch(/real date/);
    expect(read.facts).toEqual({ lot: "L1" });
  });

  it("flags a best-before date earlier than the made-on date, and allows the same day", () => {
    const early = readBatchFactsDraft({ lot: "", madeOn: "2026-06-01", bestBefore: "2026-05-31" });
    expect(early.errors.bestBefore).toMatch(/earlier than the made-on date/);
    const same = readBatchFactsDraft({ lot: "", madeOn: "2026-06-01", bestBefore: "2026-06-01" });
    expect(same.errors).toEqual({});
  });

  it("caps the lot and refuses hidden characters in it", () => {
    expect(
      readBatchFactsDraft({ ...EMPTY_BATCH_FACTS_DRAFT, lot: "L".repeat(FACT_LIMITS.lot) }).errors,
    ).toEqual({});
    expect(
      readBatchFactsDraft({ ...EMPTY_BATCH_FACTS_DRAFT, lot: "L".repeat(FACT_LIMITS.lot + 1) })
        .errors.lot,
    ).toMatch(/characters/);
    expect(
      readBatchFactsDraft({ ...EMPTY_BATCH_FACTS_DRAFT, lot: `L1${RIGHT_TO_LEFT_OVERRIDE}` }).errors
        .lot,
    ).toMatch(/hidden control character/);
    expect(FACT_LIMITS.lot).toBe(60);
  });
});

describe("parseBatchFactsBody (the proxy's read of a request)", () => {
  it("treats a missing or null value as no facts", () => {
    expect(parseBatchFactsBody(undefined)).toEqual({ ok: true, facts: null });
    expect(parseBatchFactsBody(null)).toEqual({ ok: true, facts: null });
    expect(parseBatchFactsBody({})).toEqual({ ok: true, facts: null });
    expect(parseBatchFactsBody({ lot: "", madeOn: null })).toEqual({ ok: true, facts: null });
  });

  it("returns the tidied facts for a good value", () => {
    expect(parseBatchFactsBody({ lot: " L2406A ", bestBefore: "2028-06-01" })).toEqual({
      ok: true,
      facts: { lot: "L2406A", bestBefore: "2028-06-01" },
    });
  });

  it("refuses anything that is not the three known text fields", () => {
    const bad: unknown[] = [
      "L1",
      ["L1"],
      { size: "50 ml" },
      { lot: 7 },
      { lot: ["L1", "L2"] },
      { madeOn: "2026-02-30" },
      { madeOn: "2026-06-01", bestBefore: "2026-05-31" },
      { lot: "L".repeat(61) },
    ];
    for (const value of bad) {
      const parsed = parseBatchFactsBody(value);
      expect(parsed.ok, JSON.stringify(value).slice(0, 50)).toBe(false);
      if (!parsed.ok) expect(parsed.error).toMatch(/facts/);
    }
  });
});

describe("describeBatchFacts", () => {
  it("writes one line from what is filled in", () => {
    expect(
      describeBatchFacts({ lot: "L2406A", madeOn: "2026-06-01", bestBefore: "2028-06-01" }),
    ).toBe("Lot L2406A · Made on 2026-06-01 · Best before 2028-06-01");
    expect(describeBatchFacts({ bestBefore: "2028-06-01" })).toBe("Best before 2028-06-01");
  });

  it("gives nothing when there is nothing to say", () => {
    expect(describeBatchFacts(null)).toBeNull();
    expect(describeBatchFacts(undefined)).toBeNull();
    expect(describeBatchFacts({})).toBeNull();
  });
});
