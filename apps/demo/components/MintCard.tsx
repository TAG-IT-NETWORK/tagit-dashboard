"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useEstimateGas,
} from "wagmi";
import { parseEther, formatEther } from "viem";
import { CONTRACTS } from "@/lib/contracts";

interface MintCardProps {
  onSuccess: (tokenId: bigint, txHash: string) => void;
}

export function MintCard({ onSuccess }: MintCardProps) {
  const { address, isConnected } = useAccount();
  const [metadataURI, setMetadataURI] = useState("ipfs://demo-asset-001");

  const {
    writeContract,
    data: hash,
    isPending: isWritePending,
    error: writeError,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    data: receipt,
  } = useWaitForTransactionReceipt({
    hash,
  });

  // Parse Transfer event to get tokenId
  useEffect(() => {
    if (isConfirmed && receipt && hash) {
      // Look for Transfer event in logs
      const transferLog = receipt.logs.find(
        (log) =>
          log.topics[0] ===
          "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
      );

      if (transferLog && transferLog.topics[3]) {
        const tokenId = BigInt(transferLog.topics[3]);
        onSuccess(tokenId, hash);
      }
    }
  }, [isConfirmed, receipt, hash, onSuccess]);

  const handleMint = () => {
    if (!address) return;

    writeContract({
      address: CONTRACTS.TAGITCore.address,
      abi: CONTRACTS.TAGITCore.abi,
      functionName: "mint",
      args: [address, metadataURI],
    });
  };

  const isPending = isWritePending || isConfirming;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, ease: "easeOut", delay: 0.1 }}
      className="card card-hover"
    >
      <div className="flex items-center gap-3 mb-6">
        <span className="text-2xl">🏭</span>
        <h2 className="text-xl font-semibold">Mint Digital Twin</h2>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-text-secondary mb-2">
            Asset Metadata
          </label>
          <input
            type="text"
            value={metadataURI}
            onChange={(e) => setMetadataURI(e.target.value)}
            placeholder="ipfs://..."
            className="input w-full font-mono text-sm"
            disabled={isPending}
          />
        </div>

        <button
          onClick={handleMint}
          disabled={!isConnected || isPending || !metadataURI}
          className="btn-primary w-full text-lg py-4 flex items-center justify-center gap-2"
        >
          {isPending ? (
            <>
              <svg
                className="animate-spin h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              {isConfirming ? "Confirming..." : "Minting..."}
            </>
          ) : (
            <>🚀 MINT DIGITAL TWIN</>
          )}
        </button>

        {!isConnected && (
          <p className="text-sm text-text-secondary text-center">
            Connect wallet to mint
          </p>
        )}

        {writeError && (
          <p className="text-sm text-red-400 text-center">
            Error: {writeError.message.slice(0, 100)}...
          </p>
        )}

        <p className="text-xs text-text-secondary text-center">
          Gas Estimate: ~0.0001 ETH
        </p>
      </div>
    </motion.div>
  );
}
