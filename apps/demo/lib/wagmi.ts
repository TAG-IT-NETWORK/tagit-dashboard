"use client";

import { http, createConfig } from "wagmi";
import { optimismSepolia } from "wagmi/chains";
import { injected, metaMask } from "wagmi/connectors";

export const config = createConfig({
  chains: [optimismSepolia],
  connectors: [injected(), metaMask()],
  transports: {
    [optimismSepolia.id]: http(),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
