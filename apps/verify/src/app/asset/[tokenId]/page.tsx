"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getAsset, CONTRACT_ADDRESS } from "@/lib/contract";
import { STATES, STATE_DESCRIPTIONS } from "@/lib/states";

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatTimestamp(ts: bigint) {
  if (ts === 0n) return "N/A";
  return new Date(Number(ts) * 1000).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

interface AssetData {
  name: string;
  state: number;
  owner: string;
  mintedAt: bigint;
  lastUpdated: bigint;
}

export default function AssetVerifyPage() {
  const params = useParams<{ tokenId: string }>();
  const [asset, setAsset] = useState<AssetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const tokenId = BigInt(params.tokenId);
        const result = await getAsset(tokenId);
        setAsset({
          name: result.name,
          state: Number(result.state),
          owner: result.owner,
          mintedAt: result.mintedAt,
          lastUpdated: result.lastUpdated,
        });
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.tokenId]);

  if (loading) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#0a0a0a]">
        <div className="w-full max-w-sm animate-pulse">
          <div className="text-center mb-8">
            <div className="h-4 w-24 bg-white/10 rounded mx-auto mb-2" />
            <div className="h-3 w-20 bg-white/5 rounded mx-auto" />
          </div>
          <div className="h-8 w-48 bg-white/10 rounded mx-auto mb-2" />
          <div className="h-4 w-16 bg-white/5 rounded mx-auto mb-6" />
          <div className="flex justify-center mb-8">
            <div className="h-12 w-36 bg-white/10 rounded-full" />
          </div>
          <div className="bg-white/5 rounded-xl border border-white/10 p-4 space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex justify-between">
                <div className="h-4 w-16 bg-white/10 rounded" />
                <div className="h-4 w-24 bg-white/10 rounded" />
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (error || !asset || asset.state === 0) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#0a0a0a]">
        <div className="text-center">
          <div className="text-6xl mb-4">?</div>
          <h1 className="text-2xl font-bold text-white mb-2">Asset Not Found</h1>
          <p className="text-gray-400 mb-6">
            Token #{params.tokenId} does not exist on-chain.
          </p>
          <a href="/" className="text-[#D4AF37] hover:underline text-sm">
            Back to TAG IT Verify
          </a>
        </div>
      </main>
    );
  }

  const state = STATES[asset.state] || STATES[0];
  const description = STATE_DESCRIPTIONS[asset.state] || "";
  const arbiscanUrl = `https://sepolia.arbiscan.io/address/${CONTRACT_ADDRESS}`;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#0a0a0a]">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-[#D4AF37]" />
            <span className="text-[#D4AF37] text-xs font-semibold tracking-widest uppercase">
              TAG IT Network
            </span>
          </div>
          <p className="text-gray-500 text-xs">Asset Verification</p>
        </div>

        {/* Product Name */}
        <h1 className="text-3xl font-bold text-white text-center mb-1">
          {asset.name}
        </h1>
        <p className="text-gray-500 text-center text-sm mb-6">
          Token #{params.tokenId}
        </p>

        {/* State Badge */}
        <div className="flex justify-center mb-8">
          <div
            className={`
              px-6 py-3 rounded-full border
              ${state.bg} ${state.text} ${state.border}
              shadow-lg ${state.glow}
              text-lg font-bold tracking-wider
              animate-pulse
            `}
          >
            {state.label}
          </div>
        </div>

        {/* Description */}
        <p className="text-gray-400 text-center text-sm mb-8">{description}</p>

        {/* Details Card */}
        <div className="bg-white/5 rounded-xl border border-white/10 p-4 space-y-3 mb-6">
          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-sm">Owner</span>
            <span className="text-white text-sm font-mono">
              {truncateAddress(asset.owner)}
            </span>
          </div>
          <div className="border-t border-white/5" />
          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-sm">Minted</span>
            <span className="text-white text-sm">
              {formatTimestamp(asset.mintedAt)}
            </span>
          </div>
          <div className="border-t border-white/5" />
          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-sm">Last Updated</span>
            <span className="text-white text-sm">
              {formatTimestamp(asset.lastUpdated)}
            </span>
          </div>
          <div className="border-t border-white/5" />
          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-sm">Chain</span>
            <span className="text-white text-sm">Arbitrum Sepolia</span>
          </div>
        </div>

        {/* Arbiscan Link */}
        <a
          href={arbiscanUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full text-center py-2.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 text-sm hover:bg-white/10 transition-colors"
        >
          Verified on Arbiscan
        </a>

        {/* Footer */}
        <p className="text-center text-gray-600 text-xs mt-8">
          Powered by TAG IT Network
        </p>
      </div>
    </main>
  );
}
