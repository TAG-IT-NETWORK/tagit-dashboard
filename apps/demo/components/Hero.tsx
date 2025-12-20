"use client";

import { motion } from "framer-motion";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { shortenAddress } from "@/lib/contracts";

export function Hero() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="text-center py-16 px-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="inline-block mb-8"
      >
        <div className="border border-border rounded-xl px-8 py-6 bg-bg-secondary/50 backdrop-blur">
          <h1 className="text-4xl font-bold tracking-tight mb-2">
            TAG IT NETWORK
          </h1>
          <p className="text-xl text-text-secondary">Build the Technosphere</p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.3 }}
        className="mb-8"
      >
        {isConnected ? (
          <div className="flex flex-col items-center gap-4">
            <div className="address-pill">
              <span className="w-2 h-2 rounded-full bg-accent-primary animate-pulse" />
              <span>{shortenAddress(address!)}</span>
            </div>
            <button
              onClick={() => disconnect()}
              className="btn-secondary text-sm"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            {connectors.map((connector) => (
              <button
                key={connector.uid}
                onClick={() => connect({ connector })}
                disabled={isPending}
                className="btn-primary min-w-[200px]"
              >
                {isPending ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="animate-spin h-4 w-4"
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
                    Connecting...
                  </span>
                ) : (
                  `Connect ${connector.name}`
                )}
              </button>
            ))}
          </div>
        )}
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.3 }}
        className="text-sm text-text-secondary"
      >
        Powered by{" "}
        <span className="text-accent-secondary">Optimism</span> •{" "}
        Secured by <span className="text-text-primary">Ethereum</span>
      </motion.p>
    </motion.section>
  );
}
