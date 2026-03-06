"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function VerifyHome() {
  const [tokenId, setTokenId] = useState("");
  const router = useRouter();

  function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    const id = tokenId.trim();
    if (id && !isNaN(Number(id))) {
      router.push(`/asset/${id}`);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#0a0a0a]">
      <div className="w-full max-w-sm text-center">
        <div className="inline-flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-[#D4AF37]" />
          <span className="text-[#D4AF37] text-xs font-semibold tracking-widest uppercase">
            TAG IT Network
          </span>
        </div>
        <h1 className="text-3xl font-bold text-white mt-4 mb-2">
          Verify Authenticity
        </h1>
        <p className="text-gray-400 text-sm mb-8">
          Tap an NFC tag or enter a token ID to verify any product on-chain.
        </p>

        <form onSubmit={handleVerify} className="space-y-3">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={tokenId}
            onChange={(e) => setTokenId(e.target.value)}
            placeholder="Enter token ID (e.g. 1, 2, 3)"
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 text-center focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37]/50"
          />
          <button
            type="submit"
            className="w-full py-3 rounded-lg bg-[#D4AF37] text-black font-semibold hover:bg-[#C4A030] transition-colors"
          >
            Verify Product
          </button>
        </form>

        <div className="mt-12 space-y-1">
          <p className="text-gray-600 text-xs">No wallet required</p>
          <p className="text-gray-600 text-xs">
            Reads directly from Arbitrum Sepolia
          </p>
        </div>
      </div>
    </main>
  );
}
