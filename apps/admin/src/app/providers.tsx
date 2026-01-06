"use client";

import { Providers, createWagmiConfig } from "@tagit/config";
import { type ReactNode, useMemo } from "react";

export function AppProviders({ children }: { children: ReactNode }) {
  // Lazily create wagmi config only on client-side to avoid SSR issues
  const wagmiConfig = useMemo(
    () => createWagmiConfig(process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || ""),
    []
  );

  return <Providers wagmiConfig={wagmiConfig}>{children}</Providers>;
}
