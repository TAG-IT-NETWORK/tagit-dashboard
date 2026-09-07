"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { fetchPriceFromProxy, isPurchasable, type CanonicalPrice } from "@/lib/price";

/**
 * Self-contained "tap to buy" widget: Privy embedded-wallet context scoped to
 * just the buy flow.
 *
 * PRICE COMES FROM THE SERVER ONLY (META-T17). On mount the widget fetches
 * GET /api/asset/[tokenId]/price (a pass-through to the tagit-services
 * pricing API) and renders NOTHING unless the response carries a live
 * purchase block (saleState 'listed'). There is no client-side price, no
 * default price, and no price prop — a page cannot inject one. The BuyButton
 * re-fetches the same endpoint immediately before payment.
 *
 * Renders nothing until NEXT_PUBLIC_PRIVY_APP_ID is set.
 *
 * PERF: the wallet stack (Privy + wagmi/viem, ~600 KB gzipped) is a lazy
 * chunk (./buy-checkout) loaded after the page has painted — a phone tap shows
 * the verdict and the product image without waiting for it. Until it arrives
 * the same button is drawn in a disabled state with the live price.
 */

const BuyCheckout = dynamic(() => import("./buy-checkout"), {
  ssr: false,
  loading: () => <BuyPlaceholder />,
});

let placeholderDisplay = "";
function BuyPlaceholder() {
  return (
    <button
      type="button"
      disabled
      aria-busy="true"
      className="w-full rounded-2xl bg-[#00D68F]/70 px-5 py-4 text-center text-base font-bold text-black opacity-80"
    >
      Buy now{placeholderDisplay ? ` · ${placeholderDisplay}` : ""}
    </button>
  );
}

export function BuyWidget(props: { tokenId: string; productName: string }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const [price, setPrice] = useState<CanonicalPrice | null>(null);

  const refetchPrice = useCallback(async () => {
    const fresh = await fetchPriceFromProxy(props.tokenId);
    setPrice(fresh);
    return fresh;
  }, [props.tokenId]);

  useEffect(() => {
    void refetchPrice();
  }, [refetchPrice]);

  if (!appId) return null;
  // Hidden entirely when there is no live purchase block.
  if (!isPurchasable(price)) return null;
  placeholderDisplay = price.display ?? "";

  return (
    <BuyCheckout
      appId={appId}
      tokenId={props.tokenId}
      productName={props.productName}
      price={price}
      refetchPrice={refetchPrice}
    />
  );
}
