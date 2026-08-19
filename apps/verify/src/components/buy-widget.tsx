"use client";

import { useCallback, useEffect, useState } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { baseSepolia } from "viem/chains";
import { BuyButton } from "./buy-button";
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
 */
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

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["email"],
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
        },
        defaultChain: baseSepolia,
        supportedChains: [baseSepolia],
        appearance: {
          theme: "dark",
          accentColor: "#00D68F",
        },
      }}
    >
      <BuyButton
        tokenId={props.tokenId}
        productName={props.productName}
        price={price}
        refetchPrice={refetchPrice}
      />
    </PrivyProvider>
  );
}
