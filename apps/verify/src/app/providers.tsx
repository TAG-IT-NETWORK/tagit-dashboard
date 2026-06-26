"use client";

import { type ReactNode } from "react";

// Privy is scoped to the BuyButton subtree (see components/buy-widget.tsx), not
// mounted globally — that keeps the static home page Privy-free and lets the
// force-dynamic verify pages own the wallet context only where "tap to buy"
// actually renders.
export function AppProviders({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
