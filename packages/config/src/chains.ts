import { optimismSepolia } from "viem/chains";

export const supportedChains = [optimismSepolia] as const;
export const defaultChain = optimismSepolia;

export type SupportedChainId = (typeof supportedChains)[number]["id"];
