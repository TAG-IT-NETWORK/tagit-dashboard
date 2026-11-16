import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { COPY, TAP_STATES } from "@/lib/consumer-copy";
import type { AssetDto, AssetLookup } from "@/lib/services";
import { recordPageModel, tapPageModel } from "@/lib/tap-page";
import { productBasics, productViewOf } from "@/lib/tap-view";
import {
  FACTS,
  OWNER,
  OWNER_SHORT,
  RECORD_NUMBER,
  RESTRICTED,
  SELLER,
  STATE,
  record,
  recordWithFacts,
  resolvedTap,
} from "@/test-support/shopper-fixtures";
import { onShow, outsideDrawer, readable, rowNames, rowOf } from "@/test-support/readable";

import { RecordResult } from "../record-result";
import { TapResult } from "../tap-result";

/**
 * TAP-T09: the facts a brand wrote for a cosmetics product, on the pages a
 * shopper reads. Built the way the server builds the page (the page model,
 * then the component), from a record that carries the `facts` block.
 *
 * REQ-S-10: the texts are brand-written and are shown as plain text.
 */

function tapPage(lookup: AssetLookup | null, state: number = STATE.ACTIVATED): string {
  const model = tapPageModel({ res: resolvedTap(state), lookup, stepsSeen: 1, tookMs: 250 });
  return renderToStaticMarkup(
    <TapResult
      state={model.state}
      product={model.product}
      recordNumber={model.recordNumber}
      technical={model.technical}
      detailsCheck={model.detailsCheck}
      missingDetails={model.missingDetails}
    />,
  );
}

function recordPage(lookup: AssetLookup): string {
  const model = recordPageModel(lookup, RECORD_NUMBER);
  return renderToStaticMarkup(
    <RecordResult
      state={model.state}
      product={model.product}
      chips={model.chips}
      recordNumber={model.recordNumber}
      technical={model.technical}
      detailsCheck={model.detailsCheck}
      retryHref={`/asset/${RECORD_NUMBER}`}
      jsonLd={model.jsonLd}
    />,
  );
}

/**
 * One row of a page, as it is read out: its title, then what it holds. The
 * facts live in rows that open (see <ProductRows>): "about" for the short
 * facts, and one row each for how to use, warnings and ingredients.
 */
function row(html: string, name: string): string[] {
  const markup = rowOf(html, name);
  expect(markup, `the page has a "${name}" row`).not.toBe("");
  return readable(markup)
    .split("\n")
    .filter((line) => line !== "[closed drawer]" && line !== "[end of drawer]");
}

/** The "About this product" row, as one text. */
const about = (html: string) => row(html, "about").join("\n");

describe("the view model", () => {
  it("carries the facts of a record that has them, and none for one that has not", () => {
    expect(productViewOf(recordWithFacts(STATE.ACTIVATED)).facts).toEqual({
      size: "50 ml",
      batch: "L2406A",
      madeOn: "Jun 1, 2026",
      bestBefore: "Jun 1, 2028",
      useWithin: "12 months of opening",
      howToUse: FACTS.howToUse,
      warnings: FACTS.warnings,
      ingredients: FACTS.ingredients,
    });
    expect(productViewOf(record(STATE.ACTIVATED))).not.toHaveProperty("facts");
  });

  it("gives a private or missing record no facts", () => {
    for (const lookup of [RESTRICTED, { kind: "none" }, { kind: "unavailable" }, null] as const) {
      expect(productViewOf(lookup)).not.toHaveProperty("facts");
    }
  });

  it("puts the size on the one line under the name, between brand and origin", () => {
    expect(productBasics(productViewOf(recordWithFacts(STATE.ACTIVATED)))).toEqual([
      "TAG IT Demo",
      "50 ml",
      "Made in South Korea",
    ]);
    expect(productBasics(productViewOf(record(STATE.ACTIVATED)))).toEqual([
      "TAG IT Demo",
      "Made in South Korea",
    ]);
  });
});

describe("the tap page, for an item with product facts", () => {
  const html = tapPage(recordWithFacts(STATE.ACTIVATED, true));

  it("reads, in About this product, exactly this", () => {
    expect(row(html, "about")).toEqual([
      "## About this product",
      "A light daily face cream for dry skin. 50 ml jar.",
      "Brand: TAG IT Demo",
      "Size: 50 ml",
      "Made in: South Korea",
      "Product code: TD-RC-50",
      "Batch: L2406A",
      "Made on: Jun 1, 2026",
      "Best before: Jun 1, 2028",
      "Use within: 12 months of opening",
      "Last updated: Sep 5, 2026",
    ]);
  });

  it("reads, in the three rows for the brand's longer texts, exactly this", () => {
    expect(row(html, "how-to-use")).toEqual([
      "## How to use",
      "Apply a small amount to clean skin, morning and evening.",
    ]);
    expect(row(html, "warnings")).toEqual([
      "## Warnings",
      "For external use only. Avoid contact with eyes.",
    ]);
    expect(row(html, "ingredients")).toEqual([
      "## Ingredients",
      "Aqua, Glycerin, Sodium DNA, Niacinamide, Panthenol",
    ]);
  });

  it("puts those rows right after About this product, in that order", () => {
    const names = rowNames(html);
    const at = names.indexOf("about");
    expect(names.slice(at, at + 4)).toEqual(["about", "how-to-use", "warnings", "ingredients"]);
  });

  it("names the size under the product's name", () => {
    expect(readable(html)).toContain("TAG IT Demo · 50 ml · Made in South Korea");
  });

  it("keeps the verdict first and unchanged", () => {
    const text = readable(html);
    expect(text.indexOf(`# ${TAP_STATES.newForSale.headline}`)).toBeLessThan(
      text.indexOf("## About this product"),
    );
    expect((html.match(/<h1\b/g) ?? []).length).toBe(1);
  });

  it("keeps every one of those texts in a row that needs no script to open", () => {
    for (const [name, text] of [
      ["how-to-use", FACTS.howToUse],
      ["warnings", FACTS.warnings],
      ["ingredients", FACTS.ingredients],
    ] as const) {
      const markup = rowOf(html, name);
      expect(markup, name).toMatch(/^<details[^>]*><summary/);
      expect(markup, name).toContain(text);
      // The text is in the page whether or not the row is open: nothing but
      // the browser's own closed state keeps it out of sight.
      expect(markup, name).not.toMatch(/\shidden[\s=>]|display:\s*none/);
      expect(markup, name).not.toContain("data-needs-script");
    }
    // …and none of it is on show before a row is opened
    const shown = readable(onShow(html));
    for (const text of [FACTS.howToUse!, FACTS.warnings!, FACTS.ingredients!, "Batch"]) {
      expect(shown).not.toContain(text);
    }
  });

  it("adds nothing a shopper page must not show", () => {
    const shown = outsideDrawer(html);
    for (const secret of [OWNER, OWNER_SHORT, SELLER]) expect(shown).not.toContain(secret);
    // The ingredients drawer is ordinary page content: it is part of `shown`.
    expect(shown).toContain(FACTS.ingredients);
  });
});

describe("only what the brand filled in", () => {
  it("shows a lone fact and none of the empty ones", () => {
    const page = tapPage(recordWithFacts(STATE.ACTIVATED, false, { size: "50 ml" }));
    const section = about(page);
    expect(section).toContain("Size: 50 ml");
    for (const label of ["Batch", "Made on", "Best before", "Use within"]) {
      expect(section, label).not.toContain(label);
    }
    // no row for a text the brand did not write
    for (const name of ["how-to-use", "warnings", "ingredients"]) {
      expect(rowNames(page), name).not.toContain(name);
    }
    for (const title of [COPY.about.howToUse, COPY.about.warnings, COPY.about.ingredients]) {
      expect(readable(page), title).not.toContain(title);
    }
  });

  it("an item without facts reads as it did before facts existed", () => {
    const page = tapPage(record(STATE.ACTIVATED));
    expect(row(page, "about")).toEqual([
      "## About this product",
      "A light daily face cream for dry skin. 50 ml jar.",
      "Brand: TAG IT Demo",
      "Made in: South Korea",
      "Product code: TD-RC-50",
      "Last updated: Sep 5, 2026",
    ]);
    expect(rowNames(page)).toEqual(["about", "how-we-know", "technical"]);
  });

  it("has a row for a fact even when it is all the record says about the product", () => {
    const bare: AssetDto = {
      tokenId: RECORD_NUMBER,
      stateCode: STATE.ACTIVATED,
      name: "Renewal Cream",
      facts: { ingredients: FACTS.ingredients },
    };
    const page = tapPage({ kind: "record", dto: bare });
    expect(row(page, "ingredients")).toEqual(["## Ingredients", FACTS.ingredients]);
    // …and no empty "About this product" row beside it
    expect(rowNames(page)).not.toContain("about");
  });
});

describe("every state that shows a product shows its facts", () => {
  it.each([
    ["for sale", STATE.ACTIVATED, true],
    ["owned", STATE.CLAIMED, false],
    ["not released", STATE.BOUND, false],
    ["reported", STATE.FLAGGED, false],
    ["retired", STATE.RECYCLED, false],
  ] as const)("%s", (_name, state, listed) => {
    const page = tapPage(recordWithFacts(state, listed), state);
    expect(about(page)).toContain("Batch: L2406A");
    expect(row(page, "warnings")).toEqual(["## Warnings", FACTS.warnings]);
  });

  it("a private item shows none", () => {
    const html = tapPage(RESTRICTED, STATE.CLAIMED);
    const text = readable(html);
    expect(text).not.toContain("## About this product");
    for (const value of [FACTS.ingredients!, FACTS.lot!, FACTS.howToUse!]) {
      expect(html).not.toContain(value);
    }
  });
});

describe("the record page (/asset/…)", () => {
  it("shows the same facts as the tap page", () => {
    const html = recordPage(recordWithFacts(STATE.ACTIVATED, true));
    const tap = tapPage(recordWithFacts(STATE.ACTIVATED, true));
    for (const name of ["about", "how-to-use", "warnings", "ingredients"]) {
      expect(row(html, name), name).toEqual(row(tap, name));
    }
    expect(about(html)).toContain("Batch: L2406A");
    expect(readable(html)).toContain("TAG IT Demo · 50 ml · Made in South Korea");
  });

  it("a private record shows none", () => {
    const html = recordPage(RESTRICTED);
    expect(html).not.toContain(FACTS.ingredients);
    expect(readable(html)).not.toContain("## About this product");
  });
});

describe("brand text is shown as text (REQ-S-10)", () => {
  const HOSTILE = {
    size: "<b>50 ml</b>",
    howToUse: "<img src=x onerror=alert(1)> <script>alert(2)</script>",
    warnings: "[Claim your refund](https://evil.example/phish) javascript:alert(3)",
    ingredients: '"><a href="https://evil.example">Aqua</a> &lt;not-decoded&gt; {"verified": true}',
    lot: "<svg/onload=alert(4)>",
  };
  const html = tapPage(recordWithFacts(STATE.FLAGGED, false, HOSTILE), STATE.FLAGGED);

  it("creates no element, link or script from it", () => {
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<script>alert(2)");
    expect(html).not.toContain("<svg/onload");
    expect(html).not.toContain("<b>50 ml</b>");
    expect(html).not.toMatch(/<a\b[^>]*evil\.example/);
    expect(html).not.toMatch(/href="javascript:/i);
    // The page has exactly the links it has for the same item without the
    // hostile text: the brand's words added none.
    const hrefs = (page: string) =>
      [...page.matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)].map((m) => m[1]).sort();
    const clean = tapPage(recordWithFacts(STATE.FLAGGED), STATE.FLAGGED);
    expect(hrefs(html)).toEqual(hrefs(clean));
    expect(hrefs(html).length).toBeGreaterThan(0);
  });

  it("shows every character of it, escaped", () => {
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("&lt;script&gt;alert(2)&lt;/script&gt;");
    expect(html).toContain("[Claim your refund](https://evil.example/phish) javascript:alert(3)");
    // An entity the brand typed stays an entity typed, not a decoded tag.
    expect(html).toContain("&amp;lt;not-decoded&amp;gt;");
    const section = about(html);
    expect(section).toContain("Size: <b>50 ml</b>");
    expect(section).toContain("Batch: <svg/onload=alert(4)>");
  });

  it("cannot change the verdict: a reported item stays reported", () => {
    const text = readable(html);
    expect(text).toContain(`# ${TAP_STATES.reported.headline}`);
    expect(text).not.toContain("# Authentic");
  });
});
