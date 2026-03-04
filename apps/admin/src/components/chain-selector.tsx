"use client";

import { useChainId, useSwitchChain } from "wagmi";
import { supportedChains, getPrimaryChainId, getChainRole, isMultiChainEnabled } from "@tagit/config";

const chainLabels: Record<number, string> = {
  421614: "Arbitrum Sepolia",
  11155420: "OP Sepolia",
};

const chainColors: Record<number, string> = {
  421614: "bg-blue-500",
  11155420: "bg-red-500",
};

export function ChainSelector() {
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const multiChain = isMultiChainEnabled();
  const primaryId = getPrimaryChainId();

  // When multi-chain is disabled, only show the primary chain
  const visibleChains = multiChain
    ? supportedChains
    : supportedChains.filter((c) => c.id === primaryId);

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
            <span
              className={`w-2 h-2 rounded-full ${chainColors[chain.id] ?? "bg-gray-500"}`}
            />
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
