import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http, fallback, createConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import { optimismSepolia } from "viem/chains";
import { supportedChains, arbitrumSepolia } from "./chains";

const opRpcUrl = process.env.NEXT_PUBLIC_OP_SEPOLIA_RPC;
const arbRpcUrl = process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC || process.env.NEXT_PUBLIC_ALCHEMY_ARBITRUM_SEPOLIA_URL;

// Public fallback RPCs for when Alchemy is unavailable or misconfigured
const ARB_SEPOLIA_PUBLIC_RPC = "https://sepolia-rollup.arbitrum.io/rpc";

export function createWagmiConfig(projectId: string) {
  const transports = {
    [arbitrumSepolia.id]: arbRpcUrl
      ? fallback([http(arbRpcUrl), http(ARB_SEPOLIA_PUBLIC_RPC)])
      : http(ARB_SEPOLIA_PUBLIC_RPC),
    [optimismSepolia.id]: http(opRpcUrl),
  };

  const pollingInterval = 4_000; // 4s — improves receipt detection on testnets

  // If no projectId is provided, create a basic config with injected wallets only
  if (!projectId) {
    return createConfig({
      chains: supportedChains,
      connectors: [
        injected({ target: "metaMask" }),
      ],
      transports,
      pollingInterval,
      ssr: true,
    });
  }

  return getDefaultConfig({
    appName: "TAG IT Dashboard",
    projectId,
    chains: supportedChains,
    transports,
    pollingInterval,
    ssr: true,
  });
}

// Default config for development (requires NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID env var)
// Uses a placeholder during build time to allow static generation
export const wagmiConfig = createWagmiConfig(
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "placeholder-build-id"
);
