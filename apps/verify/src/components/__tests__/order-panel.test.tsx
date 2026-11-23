import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { OrderAnswer, OrderView } from "@/lib/card-checkout";
import { COPY } from "@/lib/consumer-copy";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));

import { OrderPanel, OrderReturn } from "../order-return";

/**
 * TAP-T14: what a buyer reads on the way back from the card page. Rendered as
 * it ships. The rule under test: the panel says "It's yours" for one view
 * only, and "you haven't been charged" only where no payment was made.
 */

const ORDER = "ord_01JD0000000000000000000000";
const order = (state: OrderAnswer["state"], onRegistry = false): OrderView => ({
  kind: "order",
  order: { orderId: ORDER, tokenId: "62", state, onRegistry },
});
// React writes an apostrophe in text as an entity; read the panel as a person would.
const text = (html: string) => html.replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const panel = (view: OrderView) =>
  text(renderToStaticMarkup(<OrderPanel view={view} tokenId="62" productName="Day Cream" />));

const ALL: Array<[string, OrderView]> = [
  ["cancelled", { kind: "cancelled" }],
  ["asking", { kind: "asking" }],
  ["waiting", order("waiting")],
  ["paid", order("paid")],
  ["registered", order("registered", true)],
  ["recorded", order("registered", false)],
  ["problem", order("problem")],
  ["expired", order("expired")],
  ["slow", { kind: "slow" }],
  ["unknown", { kind: "unknown" }],
];

describe("OrderPanel", () => {
  it("is nothing on an ordinary visit", () => {
    expect(panel({ kind: "none" })).toBe("");
    expect(renderToStaticMarkup(<OrderReturn tokenId="62" productName="Day Cream" />)).toBe("");
  });

  it("says the item is the buyer's only when it is registered on the registry", () => {
    for (const [name, view] of ALL) {
      const html = panel(view);
      expect(html.includes(COPY.buy.successTitle), name).toBe(name === "registered");
      expect(html.includes("is now registered to you"), name).toBe(name === "registered");
    }
  });

  it("says a payment was received only when the server said so", () => {
    for (const [name, view] of ALL) {
      const said = /payment (was |for .* was )?received/i.test(panel(view));
      expect(said, name).toBe(["paid", "recorded", "problem"].includes(name));
    }
  });

  it("says 'you haven't been charged' only where nothing was paid", () => {
    for (const [name, view] of ALL) {
      expect(panel(view).includes("You haven't been charged"), name).toBe(
        name === "cancelled" || name === "expired",
      );
    }
  });

  it("asks the buyer not to pay again, and offers a report, wherever the outcome is unsure", () => {
    for (const [name, view] of ALL) {
      const html = panel(view);
      const unsure = ["problem", "slow", "unknown"].includes(name);
      expect(html.includes("don't pay again"), name).toBe(unsure);
      expect(html.includes("mailto:"), name).toBe(unsure);
    }
  });

  it("is busy only while something is still expected", () => {
    for (const [name, view] of ALL) {
      expect(panel(view).includes('aria-busy="true"'), name).toBe(
        ["asking", "waiting", "paid"].includes(name),
      );
    }
  });

  it("names the product, and never an order id, a wallet or an amount", () => {
    expect(panel(order("registered", true))).toContain("Day Cream is now registered to you.");
    expect(panel(order("registered", false))).toContain("Your payment for Day Cream was received.");
    for (const [name, view] of ALL) {
      const html = panel(view);
      expect(html.includes(ORDER), name).toBe(false);
      expect(/0x[0-9a-f]{6}/i.test(html), name).toBe(false);
      expect(html.includes("$"), name).toBe(false);
    }
  });

  it("marks each view, so a walk through the page can tell them apart", () => {
    const marks = ALL.map(([, view]) => /data-order-return="([a-z]+)"/.exec(panel(view))?.[1]);
    expect(marks).toEqual([
      "cancelled",
      "asking",
      "waiting",
      "paid",
      "registered",
      "registered",
      "problem",
      "expired",
      "slow",
      "unknown",
    ]);
  });
});
