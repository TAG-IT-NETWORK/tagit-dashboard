"use client";

import { useChainId, useSwitchChain } from "wagmi";
import {
  supportedChains,
  getPrimaryChainId,
  getChainRole,
  isMultiChainEnabled,
} from "@tagit/config";

const chainLabels: Record<number, string> = {
  84532: "Base Sepolia",
};

const chainColors: Record<number, string> = {
  84532: "bg-blue-600",
};

/**
 * RETIRED chains (META-T37): the Arbitrum Sepolia and OP Sepolia mirrors are
 * gone — Base Sepolia (84532) is the only live chain. They are filtered here
 * rather than removed from @tagit/config's supportedChains so wagmi keeps
 * recognising a wallet still parked on a retired chain (and can switch it
 * back) while the header stops advertising badges for chains that no longer
 * carry TAG IT state.
 */
const RETIRED_CHAIN_IDS = new Set<number>([421614, 11155420]);

export function ChainSelector() {
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const multiChain = isMultiChainEnabled();
  const primaryId = getPrimaryChainId();

  // Retired mirrors never render; when multi-chain is disabled, only the
  // primary chain shows.
  const liveChains = supportedChains.filter((c) => !RETIRED_CHAIN_IDS.has(c.id));
  const visibleChains = multiChain ? liveChains : liveChains.filter((c) => c.id === primaryId);

  return (
    <div className="flex items-center gap-2">
      {visibleChains.map((chain) => {
        const isActive = chain.id === chainId;
        const role = getChainRole(chain.id);
        const label = chainLabels[chain.id] ?? chain.name;
        const roleLabel = role === "primary" ? "(Primary)" : "(Mirror)";
        return (
          <button
            key={chain.id}
            onClick={() => switchChain({ chainId: chain.id })}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${chainColors[chain.id] ?? "bg-gray-500"}`} />
            {label}
            {multiChain && (
              <span className={`text-[10px] ${role === "mirror" ? "opacity-60" : ""}`}>
                {roleLabel}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
