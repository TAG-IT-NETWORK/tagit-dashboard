"use client";

import { http, createConfig } from "wagmi";
import { optimismSepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

const rpcUrl = process.env.NEXT_PUBLIC_OP_SEPOLIA_RPC;

// Demo app uses MetaMask-only config (no WalletConnect/RainbowKit)
export const config = createConfig({
  chains: [optimismSepolia],
  connectors: [injected({ target: "metaMask" })],
  transports: {
    [optimismSepolia.id]: http(rpcUrl),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
