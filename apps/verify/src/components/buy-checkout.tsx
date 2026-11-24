"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { baseSepolia } from "viem/chains";
import { BuyButton } from "./buy-button";
import { CardButton } from "./card-button";
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
  method = "crypto",
  tokenId,
  productName,
  price,
  refetchPrice,
  demo,
  autoStart,
  onChooseAnother,
}: {
  appId: string;
  /** The way to pay that was chosen in the sheet. Both need the same sign-in. */
  method?: "card" | "crypto";
  tokenId: string;
  productName: string;
  price: CanonicalPrice;
  refetchPrice: () => Promise<CanonicalPrice | null>;
  demo?: boolean;
  autoStart?: boolean;
  onChooseAnother?: () => void;
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
          theme: "light",
          accentColor: "#0b72d9",
        },
      }}
    >
      {method === "card" ? (
        <CardButton
          tokenId={tokenId}
          productName={productName}
          price={price}
          refetchPrice={refetchPrice}
          demo={demo}
          onChooseAnother={onChooseAnother}
        />
      ) : (
        <BuyButton
          tokenId={tokenId}
          productName={productName}
          price={price}
          refetchPrice={refetchPrice}
          demo={demo}
          autoStart={autoStart}
          onChooseAnother={onChooseAnother}
        />
      )}
    </PrivyProvider>
  );
}
