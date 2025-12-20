"use client";

import { useState, useCallback } from "react";
import { useAccount } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import { Hero, ContractInfoCard, MintCard, SuccessCard } from "@/components";

type AppState = "idle" | "minting" | "success";

interface MintResult {
  tokenId: bigint;
  txHash: string;
}

export default function DemoPage() {
  const { address, isConnected } = useAccount();
  const [appState, setAppState] = useState<AppState>("idle");
  const [mintResult, setMintResult] = useState<MintResult | null>(null);

  const handleMintSuccess = useCallback((tokenId: bigint, txHash: string) => {
    setMintResult({ tokenId, txHash });
    setAppState("success");
  }, []);

  const handleMintAnother = useCallback(() => {
    setMintResult(null);
    setAppState("idle");
  }, []);

  return (
    <main className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <Hero />

      {/* Main Content */}
      <div className="flex-1 px-4 pb-16">
        <div className="max-w-4xl mx-auto">
          <AnimatePresence mode="wait">
            {appState === "success" && mintResult ? (
              <motion.div
                key="success"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="max-w-md mx-auto"
              >
                <SuccessCard
                  tokenId={mintResult.tokenId}
                  txHash={mintResult.txHash}
                  ownerAddress={address!}
                  onMintAnother={handleMintAnother}
                />
              </motion.div>
            ) : (
              <motion.div
                key="main"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid md:grid-cols-2 gap-6"
              >
                <ContractInfoCard />
                <MintCard onSuccess={handleMintSuccess} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-6 text-center border-t border-border">
        <p className="text-sm text-text-secondary">
          TAG IT Network Demo • OP Sepolia Testnet • Chain ID: 11155420
        </p>
      </footer>
    </main>
  );
}
