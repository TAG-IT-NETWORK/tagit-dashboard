import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http, createConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import { optimismSepolia } from "viem/chains";
import { supportedChains, arbitrumSepolia } from "./chains";

const opRpcUrl = process.env.NEXT_PUBLIC_OP_SEPOLIA_RPC;
const arbRpcUrl = process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC || process.env.NEXT_PUBLIC_ALCHEMY_ARBITRUM_SEPOLIA_URL;

export function createWagmiConfig(projectId: string) {
  const transports = {
    [arbitrumSepolia.id]: http(arbRpcUrl),
    [optimismSepolia.id]: http(opRpcUrl),
  };

  // If no projectId is provided, create a basic config with injected wallets only
  if (!projectId) {
    return createConfig({
      chains: supportedChains,
      connectors: [
        injected({ target: "metaMask" }),
      ],
      transports,
      ssr: true,
    });
  }

  return getDefaultConfig({
    appName: "TAG IT Dashboard",
    projectId,
    chains: supportedChains,
    transports,
    ssr: true,
  });
}

// Default config for development (requires NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID env var)
// Uses a placeholder during build time to allow static generation
export const wagmiConfig = createWagmiConfig(
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "placeholder-build-id"
);
