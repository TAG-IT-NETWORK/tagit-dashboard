/**
 * Server-rendered price block for /asset/[tokenId] (META-T37).
 *
 * Renders the canonical listing price from the services DTO plus, when the
 * DTO carries a price.fx block, the "≈ €xx.xx" display-currency
 * approximation. Server-safe, no client hooks — the price is in the
 * first-paint HTML alongside the verdict.
 *
 * DIVISION OF LABOUR with the buy widget (client island): this block DISPLAYS
 * the price the DTO snapshot carried; the widget re-fetches the live price
 * through /api/asset/[tokenId]/price before offering a purchase and remains
 * the only purchase surface. Nothing here is a quote.
 *
 * The fx line renders exactly what @/lib/fx returns: the server's
 * pre-formatted approx string as-is (never toFixed), an explicit "≈" +
 * "approx." marker, and an aria-label spelling the approximation out for
 * assistive tech. A malformed fx block renders nothing rather than a wrong
 * price.
 */
import type { AssetPrice } from "@/lib/services";
import { formatFxApprox } from "@/lib/fx";

export function PriceBlock({ price }: { price?: AssetPrice | null }) {
  // Only a live listing has a price worth asserting. "sold" / "not_for_sale"
  // stay silent — the lifecycle band already tells that story.
  if (!price || price.saleState !== "listed") return null;

  const fx = formatFxApprox(price.fx);
  if (!price.display && !fx) return null;

  return (
    <div
      className="rounded-2xl border border-white/10 p-5 mb-5 text-center animate-fadeUp"
      style={{ background: "rgba(255,255,255,0.03)", animationDelay: "0.35s" }}
    >
      <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Price</p>
      {price.display && <p className="text-white text-2xl font-bold font-mono">{price.display}</p>}
      {fx && (
        <p className="mt-1 text-sm text-gray-400">
          <span aria-label={fx.ariaLabel}>{fx.text}</span>{" "}
          <span aria-hidden="true" className="text-[11px] text-gray-500">
            (approx.)
          </span>
        </p>
      )}
    </div>
  );
}
