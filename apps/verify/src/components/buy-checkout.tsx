"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { baseSepolia } from "viem/chains";
import { BuyButton } from "./buy-button";
import type { CanonicalPrice } from "@/lib/price";

/**
 * The wallet half of the buy flow — Privy embedded-wallet context + the
 * BuyButton — split out of BuyWidget so the ~600 KB (gzipped) wallet stack is
 * an async chunk: a phone tap paints the verdict and the product first, and
 * this loads behind it instead of in front of it. Default export so
 * next/dynamic can pull it in.
 */
export default function BuyCheckout({
  appId,
  tokenId,
  productName,
  price,
  refetchPrice,
}: {
  appId: string;
  tokenId: string;
  productName: string;
  price: CanonicalPrice;
  refetchPrice: () => Promise<CanonicalPrice | null>;
}) {
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
      <BuyButton tokenId={tokenId} productName={productName} price={price} refetchPrice={refetchPrice} />
    </PrivyProvider>
  );
}
