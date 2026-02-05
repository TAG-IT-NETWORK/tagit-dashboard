"use client";

import { motion } from "framer-motion";
import { useReadContracts } from "wagmi";
import {
  CONTRACTS,
  TAGITCoreABI,
  shortenAddress,
  getBlockscoutAddressUrl,
} from "@/lib/contracts";
import { useState } from "react";

export function ContractInfoCard() {
  const [copied, setCopied] = useState(false);

  const { data, isLoading, isError } = useReadContracts({
    contracts: [
      {
        address: CONTRACTS.TAGITCore,
        abi: TAGITCoreABI,
        functionName: "name",
      },
      {
        address: CONTRACTS.TAGITCore,
        abi: TAGITCoreABI,
        functionName: "symbol",
      },
      {
        address: CONTRACTS.TAGITCore,
        abi: TAGITCoreABI,
        functionName: "totalSupply",
      },
    ],
  });

  const name = data?.[0]?.result as string | undefined;
  const symbol = data?.[1]?.result as string | undefined;
  const totalSupply = data?.[2]?.result as bigint | undefined;

  const copyAddress = async () => {
    await navigator.clipboard.writeText(CONTRACTS.TAGITCore);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="card card-hover"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📋</span>
          <h2 className="text-xl font-semibold">TAGITCore Contract</h2>
        </div>
        <div className="status-badge status-live">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-primary" />
          LIVE
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex justify-between">
              <div className="h-4 w-20 bg-bg-tertiary rounded animate-pulse" />
              <div className="h-4 w-32 bg-bg-tertiary rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="text-accent-warning text-center py-4">
          Failed to load contract data. Please check your connection.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-text-secondary">Name</span>
            <span className="font-medium">{name || "—"}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-text-secondary">Symbol</span>
            <span className="font-medium">{symbol || "—"}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-text-secondary">Total Supply</span>
            <span className="font-medium">
              {totalSupply !== undefined ? totalSupply.toString() : "—"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-text-secondary">Network</span>
            <span className="font-medium text-accent-secondary">
              Optimism Sepolia
            </span>
          </div>
        </div>
      )}

      <div className="mt-6 pt-6 border-t border-border">
        <button
          onClick={copyAddress}
          className="w-full address-pill justify-between hover:border-accent-primary/50 transition-colors cursor-pointer"
        >
          <span className="truncate">
            {shortenAddress(CONTRACTS.TAGITCore, 8)}
          </span>
          <span className="text-lg">{copied ? "✓" : "📋"}</span>
        </button>
      </div>

      <div className="mt-4">
        <a
          href={getBlockscoutAddressUrl(CONTRACTS.TAGITCore)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary w-full text-center block text-sm"
        >
          View on Blockscout ↗
        </a>
      </div>
    </motion.div>
  );
}
