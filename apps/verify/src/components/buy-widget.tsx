"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { baseSepolia } from "viem/chains";
import { BuyButton } from "./buy-button";

/**
 * Self-contained "tap to buy" widget: Privy embedded-wallet context scoped to
 * just the buy flow. Rendered only inside the force-dynamic verify pages (/sun,
 * /01) for ACTIVATED assets, so Privy never loads on the static home page and is
 * never prerendered at build time.
 *
 * Buyers sign in with email → Privy mints a non-custodial wallet on Base Sepolia
 * → "Buy now" flips ownership to that wallet via the backend relayer. No app, no
 * seed phrase, no gas. Renders nothing until NEXT_PUBLIC_PRIVY_APP_ID is set.
 */
export function BuyWidget(props: {
  tokenId: string;
  productName: string;
  priceUsdc: number;
}) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId) return null;

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
      <BuyButton {...props} />
    </PrivyProvider>
  );
}
