"use client";

import { Providers, createWagmiConfig } from "@tagit/config";
import { type ReactNode, useState } from "react";

function getWagmiConfig() {
  if (typeof window === "undefined") {
    // Return a minimal config during SSR to avoid indexedDB access
    return createWagmiConfig("");
  }
  return createWagmiConfig(process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "");
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [wagmiConfig] = useState(() => getWagmiConfig());
  return <Providers wagmiConfig={wagmiConfig}>{children}</Providers>;
}
