import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { offeredMethods, type PayMethod } from "@/lib/buy-methods";
import { COPY } from "@/lib/consumer-copy";
import type { CanonicalPrice } from "@/lib/price";

import { BuySheet, BuySheetBody } from "../buy-sheet";

/**
 * TAP-T13: the sheet shows the ways to pay the price endpoint returned, and
 * no others. Rendered as it ships; no DOM is needed to read what it says.
 */

const noop = () => undefined;

function body(methods: readonly PayMethod[], extra: { demo?: boolean; notice?: string } = {}) {
  return renderToStaticMarkup(
    <BuySheetBody
      methods={methods}
      priceDisplay="$23.33"
      productName="Renewal Cream"
      demo={extra.demo ?? true}
      notice={extra.notice}
      onChoose={noop}
      onClose={noop}
    />,
  );
}

const rows = (html: string) => [...html.matchAll(/data-method="([a-z]+)"/g)].map((m) => m[1]);

function priceWith(methods: unknown): CanonicalPrice {
  return {
    tokenId: "58",
    priceUsdc6: "23330000",
    display: "$23.33",
    saleState: "listed",
    version: 1,
    purchase: { payTo: "0x1", token: "USDC", chainId: 84532, settleEndpoint: "/x", methods },
  };
}

describe("BuySheetBody", () => {
  it("lists three ways when the price endpoint returns three", () => {
    const html = body(offeredMethods(priceWith(["card", "paypal", "crypto"])));
    expect(rows(html)).toEqual(["card", "paypal", "crypto"]);
    for (const method of ["card", "paypal", "crypto"] as const) {
      expect(html).toContain(COPY.buy.sheetRows[method].title);
      expect(html).toContain(COPY.buy.sheetRows[method].line);
    }
  });

  it("lists one way when it returns one, and names no other", () => {
    const html = body(offeredMethods(priceWith(["crypto"])));
    expect(rows(html)).toEqual(["crypto"]);
    expect(html).not.toContain(COPY.buy.sheetRows.card.line);
    expect(html).not.toContain(COPY.buy.sheetRows.paypal.line);
  });

  it("lists none when it returns none", () => {
    const html = body(offeredMethods(priceWith([])));
    expect(rows(html)).toEqual([]);
    for (const method of ["card", "paypal", "crypto"] as const) {
      expect(html).not.toContain(COPY.buy.sheetRows[method].line);
    }
  });

  it("says what is being bought and for how much, under the copy deck's title", () => {
    const html = body(["card"]);
    expect(html).toContain(COPY.buy.sheetTitle);
    expect(html).toContain("Renewal Cream · $23.33");
    expect(html).toContain(COPY.buy.sheetFooter);
  });

  it("says 'no real money is charged' only for a demo checkout", () => {
    expect(body(["card"], { demo: true })).toContain(COPY.buy.demoNote);
    expect(body(["card"], { demo: false })).not.toContain(COPY.buy.demoNote);
  });

  it("shows a note as an alert, and none otherwise", () => {
    expect(body(["card"], { notice: COPY.buy.methodUnavailable })).toMatch(
      /role="alert"[^>]*>That way to pay isn(&#x27;|')t available here yet/,
    );
    expect(body(["card"])).not.toContain('role="alert"');
  });

  it("gives every row and the close button a touch target of 44 px or more, and a name", () => {
    const html = body(["card", "paypal", "crypto"]);
    expect(html.match(/min-h-\[64px\]/g)).toHaveLength(3);
    expect(html).toContain(`aria-label="${COPY.buy.sheetClose}"`);
    expect(html).toMatch(/aria-label="Close"[^>]*class="[^"]*h-11 w-11/);
  });

  it("never shows a wallet address or the word 'gasless'", () => {
    const html = body(["card", "paypal", "crypto"]);
    expect(html).not.toMatch(/0x[0-9a-fA-F]{6,}/);
    expect(html).not.toMatch(/gasless|faucet|sign in to buy/i);
  });
});

describe("BuySheet", () => {
  it("draws nothing inside the dialog while it is shut", () => {
    const html = renderToStaticMarkup(
      <BuySheet
        open={false}
        methods={["card"]}
        priceDisplay="$1.00"
        productName="X"
        demo
        onChoose={noop}
        onClose={noop}
      />,
    );
    expect(html).toMatch(/^<dialog[^>]*aria-labelledby="buy-sheet-title"[^>]*><\/dialog>$/);
  });
});
