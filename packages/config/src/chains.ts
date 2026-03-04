import { optimismSepolia, arbitrumSepolia } from "viem/chains";

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

export { optimismSepolia, arbitrumSepolia };
