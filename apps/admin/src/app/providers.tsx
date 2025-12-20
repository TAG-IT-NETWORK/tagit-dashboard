"use client";

import { Providers, createWagmiConfig } from "@tagit/config";
import { type ReactNode } from "react";

const wagmiConfig = createWagmiConfig(
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || ""
);

export function AppProviders({ children }: { children: ReactNode }) {
  return <Providers wagmiConfig={wagmiConfig}>{children}</Providers>;
}
