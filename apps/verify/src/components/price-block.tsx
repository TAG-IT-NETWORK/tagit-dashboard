/**
 * The approximate price in the shopper's display currency, shown under the
 * product's price (META-T37, restyled for the light page in TAP-T08).
 *
 * The price itself is on the product card, straight from the server's listing
 * (`price.display`). This line adds the "≈ €xx.xx" approximation when the
 * record carries a price.fx block. Server-safe, no client hooks — it is in the
 * first-paint HTML alongside the verdict.
 *
 * DIVISION OF LABOUR with the buy widget (client island): this DISPLAYS what
 * the record snapshot carried; the widget re-fetches the live price through
 * /api/asset/[tokenId]/price before offering a purchase and remains the only
 * purchase surface. Nothing here is a quote.
 *
 * The fx line renders exactly what @/lib/fx returns: the server's
 * pre-formatted approx string as-is (never toFixed), an explicit "≈" +
 * "approx." marker, and the same approximation spelled out in words for
 * assistive tech. A malformed fx block renders nothing rather than a wrong
 * price.
 */
import type { AssetPrice } from "@/lib/services";
import { formatFxApprox, type FxApproxRender } from "@/lib/fx";

/** The "≈ €66.54 (approx.)" line itself, from an already-formatted approximation. */
export function PriceApprox({ fx }: { fx: FxApproxRender }) {
  return (
    <p className="text-[13px] leading-[18px] text-muted" data-price-approx>
      {/* What is drawn, and what is read out: a label on a plain <span> is not
          reliably announced, so the spoken wording is real (hidden) text. */}
      <span aria-hidden="true">{fx.text} (approx.)</span>
      <span className="sr-only">{fx.ariaLabel}</span>
    </p>
  );
}

export function PriceBlock({ price }: { price?: AssetPrice | null }) {
  // Only a live listing has a price worth asserting. "sold" / "not_for_sale"
  // stay silent.
  if (!price || price.saleState !== "listed") return null;

  const fx = formatFxApprox(price.fx);
  return fx ? <PriceApprox fx={fx} /> : null;
}
