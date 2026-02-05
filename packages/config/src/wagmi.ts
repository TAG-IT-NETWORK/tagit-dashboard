import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http, createConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import { optimismSepolia } from "viem/chains";
import { supportedChains } from "./chains";

const rpcUrl = process.env.NEXT_PUBLIC_OP_SEPOLIA_RPC;

export function createWagmiConfig(projectId: string) {
  // If no projectId is provided, create a basic config with injected wallets only
  if (!projectId) {
    return createConfig({
      chains: supportedChains,
      connectors: [
        injected({ target: "metaMask" }),
      ],
      transports: {
        [optimismSepolia.id]: http(rpcUrl),
      },
      ssr: true,
    });
  }

  return getDefaultConfig({
    appName: "TAG IT Dashboard",
    projectId,
    chains: supportedChains,
    transports: {
      [optimismSepolia.id]: http(rpcUrl),
    },
    ssr: true,
  });
}

// Default config for development (requires NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID env var)
// Uses a placeholder during build time to allow static generation
export const wagmiConfig = createWagmiConfig(
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "placeholder-build-id"
);
