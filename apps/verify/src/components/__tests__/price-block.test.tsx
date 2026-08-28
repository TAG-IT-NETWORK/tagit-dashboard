import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PriceBlock } from "../price-block";
import type { AssetPrice } from "@/lib/services";

/**
 * META-T37 acceptance: SNAPSHOT tests of the RENDERED PriceBlock output
 * (DASH-T37-SNAPSHOT-WORDING), alongside the property suite in
 * src/lib/__tests__/fx.test.ts.
 *
 * Division of labour: fx.test.ts pins the INVARIANT (a rendered fx price
 * never exceeds its currency's fraction digits, enforced by refusal); these
 * snapshots pin the literal markup a reader receives for the two canonical
 * cases — EUR (2-exponent, "≈ €66.54") and JPY (0-exponent, "≈ ¥12366") —
 * including the ≈ marker, the "(approx.)" suffix and the aria-label. A
 * markup regression that the property test cannot see (dropped aria-label,
 * reordered nodes, lost approx marker) fails here.
 *
 * PriceBlock is a synchronous server component with no hooks, so
 * renderToStaticMarkup drives it directly — no DOM, no client runtime.
 */

function listed(fx: AssetPrice["fx"]): AssetPrice {
  return {
    tokenId: "50",
    priceUsdc6: "72990000",
    display: "72.99 USDC",
    fx,
    saleState: "listed",
    version: 3,
  };
}

describe("PriceBlock — rendered-output snapshots", () => {
  it("EUR: two-decimal fx approximation renders '≈ €66.54' with the approx marker", () => {
    const html = renderToStaticMarkup(
      <PriceBlock price={listed({ currency: "EUR", approx: "66.54" })} />,
    );
    // Sanity anchors so a stale-but-accepted snapshot cannot drift silently.
    expect(html).toContain("≈ €66.54");
    expect(html).toContain("(approx.)");
    expect(html).toMatchSnapshot();
  });

  it("JPY: zero-decimal fx approximation renders '≈ ¥12366' with no invented fraction", () => {
    const html = renderToStaticMarkup(
      <PriceBlock price={listed({ currency: "JPY", approx: "12366" })} />,
    );
    expect(html).toContain("≈ ¥12366");
    expect(html).not.toContain("12,366");
    expect(html).toMatchSnapshot();
  });
});
