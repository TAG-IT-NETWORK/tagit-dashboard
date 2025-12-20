import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http, createConfig } from "wagmi";
import { optimismSepolia } from "viem/chains";
import { supportedChains } from "./chains";

export function createWagmiConfig(projectId: string) {
  // If no projectId is provided, create a basic config without WalletConnect
  if (!projectId) {
    return createConfig({
      chains: supportedChains,
      transports: {
        [optimismSepolia.id]: http(),
      },
      ssr: true,
    });
  }

  return getDefaultConfig({
    appName: "TAG IT Dashboard",
    projectId,
    chains: supportedChains,
    transports: {
      [optimismSepolia.id]: http(),
    },
    ssr: true,
  });
}

// Default config for development (requires NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID env var)
// Uses a placeholder during build time to allow static generation
export const wagmiConfig = createWagmiConfig(
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "placeholder-build-id"
);
