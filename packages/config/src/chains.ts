import { defineChain } from "viem";
import { optimismSepolia, arbitrumSepolia as _arbitrumSepolia } from "viem/chains";

// Custom fee estimator for Arbitrum Sepolia.
// MetaMask and wagmi's internal simulation ignore baseFeeMultiplier,
// so we override estimateFeesPerGas to fetch the real baseFee and apply
// a 3x buffer. This is called by viem before any gas estimation or
// transaction simulation, ensuring the values reach the node.
export const arbitrumSepolia = defineChain({
  ..._arbitrumSepolia,
  fees: {
    async estimateFeesPerGas({ client }) {
      try {
        const block = await (client as any).request({
          method: "eth_getBlockByNumber",
          params: ["latest", false],
        });
        const baseFee = BigInt(block.baseFeePerGas || "0x1312D00");
        return {
          maxFeePerGas: baseFee * 3n,
          maxPriorityFeePerGas: 1_000_000n,
        };
      } catch {
        // Fallback: 0.5 gwei — 25x typical Arb Sepolia baseFee
        return {
          maxFeePerGas: 500_000_000n,
          maxPriorityFeePerGas: 1_000_000n,
        };
      }
    },
  },
});

export const supportedChains = [arbitrumSepolia, optimismSepolia] as const;
export const defaultChain = arbitrumSepolia;

export type SupportedChainId = (typeof supportedChains)[number]["id"];

/** Explorer base URLs by chain ID */
export const explorerUrls: Record<number, string> = {
  [arbitrumSepolia.id]: "https://sepolia.arbiscan.io",
  [optimismSepolia.id]: "https://optimism-sepolia.blockscout.com",
};

export function getExplorerUrl(chainId: number): string {
  return explorerUrls[chainId] ?? explorerUrls[defaultChain.id];
}

export function getExplorerTxUrl(chainId: number, hash: string): string {
  return `${getExplorerUrl(chainId)}/tx/${hash}`;
}

export function getExplorerAddressUrl(chainId: number, address: string): string {
  return `${getExplorerUrl(chainId)}/address/${address}`;
}

/** Read NEXT_PUBLIC_PRIMARY_CHAIN env var and return the primary chain ID */
export function getPrimaryChainId(): number {
  const env = typeof process !== "undefined" ? process.env?.NEXT_PUBLIC_PRIMARY_CHAIN : undefined;
  return env === "op_sepolia" ? optimismSepolia.id : arbitrumSepolia.id;
}

/** Return the mirror (non-primary) chain ID */
export function getMirrorChainId(): number {
  return getPrimaryChainId() === arbitrumSepolia.id ? optimismSepolia.id : arbitrumSepolia.id;
}

/** Return "primary" or "mirror" for a given chain ID */
export function getChainRole(chainId: number): "primary" | "mirror" {
  return chainId === getPrimaryChainId() ? "primary" : "mirror";
}

/** Whether dual-chain mode is enabled (default: true) */
export function isMultiChainEnabled(): boolean {
  const env = typeof process !== "undefined" ? process.env?.NEXT_PUBLIC_MULTI_CHAIN_ENABLED : undefined;
  return env !== "false";
}

export { optimismSepolia };
