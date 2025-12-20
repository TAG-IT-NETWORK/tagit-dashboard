"use client";

import { motion } from "framer-motion";
import { useReadContract } from "wagmi";
import {
  CONTRACTS,
  STATE_NAMES,
  shortenAddress,
  shortenHash,
  getBlockscoutTxUrl,
} from "@/lib/contracts";

interface SuccessCardProps {
  tokenId: bigint;
  txHash: string;
  ownerAddress: string;
  onMintAnother: () => void;
}

export function SuccessCard({
  tokenId,
  txHash,
  ownerAddress,
  onMintAnother,
}: SuccessCardProps) {
  const { data: state } = useReadContract({
    address: CONTRACTS.TAGITCore.address,
    abi: CONTRACTS.TAGITCore.abi,
    functionName: "getState",
    args: [tokenId],
  });

  const stateName = state !== undefined ? STATE_NAMES[Number(state)] : "MINTED";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, type: "spring", bounce: 0.4 }}
      className="card text-center relative overflow-hidden"
    >
      {/* Confetti animation */}
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ delay: 2, duration: 0.5 }}
        className="absolute inset-0 pointer-events-none"
      >
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            initial={{
              x: "50%",
              y: "50%",
              scale: 0,
            }}
            animate={{
              x: `${Math.random() * 100}%`,
              y: `${Math.random() * 100}%`,
              scale: [0, 1, 0],
              rotate: [0, 360],
            }}
            transition={{
              duration: 2,
              delay: i * 0.05,
              ease: "easeOut",
            }}
            className="absolute w-2 h-2 rounded-full"
            style={{
              backgroundColor: ["#00d4aa", "#00a3ff", "#ffaa00", "#ff6b6b"][
                i % 4
              ],
            }}
          />
        ))}
      </motion.div>

      <div className="mb-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", bounce: 0.5 }}
          className="text-5xl mb-4"
        >
          ✨ 🎉 ✨
        </motion.div>
        <h2 className="text-2xl font-bold text-accent-primary">
          DIGITAL TWIN CREATED
        </h2>
      </div>

      <div className="bg-bg-tertiary rounded-lg p-6 mb-6 text-left space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-text-secondary">Token ID</span>
          <span className="font-mono font-bold text-lg">
            #{tokenId.toString()}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-text-secondary">State</span>
          <span className="flex items-center gap-2">
            {stateName}
            <span className="w-2 h-2 rounded-full bg-accent-primary" />
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-text-secondary">Owner</span>
          <span className="font-mono text-sm">
            {shortenAddress(ownerAddress)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-text-secondary">Tx Hash</span>
          <span className="font-mono text-sm">{shortenHash(txHash)}</span>
        </div>
      </div>

      <div className="flex gap-3">
        <a
          href={getBlockscoutTxUrl(txHash)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary flex-1 text-center"
        >
          View on Blockscout ↗
        </a>
        <button onClick={onMintAnother} className="btn-primary flex-1">
          Mint Another
        </button>
      </div>
    </motion.div>
  );
}
