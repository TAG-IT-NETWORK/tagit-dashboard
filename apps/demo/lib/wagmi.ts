"use client";

import { http, createConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import { supportedChains } from "@tagit/config";
import { optimismSepolia, arbitrumSepolia, baseSepolia } from "viem/chains";

const opRpcUrl = process.env.NEXT_PUBLIC_OP_SEPOLIA_RPC;
const arbRpcUrl = process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC;
const baseRpcUrl = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC;

// Demo app uses MetaMask-only config (no WalletConnect/RainbowKit)
export const config = createConfig({
  chains: supportedChains,
  connectors: [injected({ target: "metaMask" })],
  transports: {
    [arbitrumSepolia.id]: http(arbRpcUrl),
    [optimismSepolia.id]: http(opRpcUrl),
    [baseSepolia.id]: http(baseRpcUrl),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
