"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { getAsset, getMetadataForToken, CONTRACT_ADDRESS } from "@/lib/contract";
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
  state: number;
  owner: string;
  timestamp: bigint;
  productName?: string;
  msrp?: string;
  flags?: number;
}

export default function AssetVerifyPage() {
  const params = useParams<{ tokenId: string }>();
  const searchParams = useSearchParams();
  const [asset, setAsset] = useState<AssetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const tokenId = BigInt(params.tokenId);
        const result = await getAsset(tokenId);

        // Static metadata + URL params override
        const meta = getMetadataForToken(params.tokenId);
        const productName = searchParams.get("name") || meta.productName || undefined;
        const msrp = searchParams.get("msrp") || meta.msrp || undefined;

        setAsset({
          state: result.state,
          owner: result.owner,
          timestamp: result.timestamp,
          productName,
          msrp,
        });
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.tokenId, searchParams]);

  if (loading) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "#000" }}>
        <div className="w-full max-w-[420px] animate-pulse py-[52px] px-5">
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 rounded-full bg-white/5" />
          </div>
          <div className="h-8 w-32 bg-white/10 rounded mx-auto mb-2" />
          <div className="h-4 w-48 bg-white/5 rounded mx-auto mb-6" />
          <div className="flex justify-center mb-8">
            <div className="h-10 w-32 bg-white/10 rounded-full" />
          </div>
          <div className="bg-white/5 rounded-2xl p-5 space-y-4">
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
      <main className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "#000" }}>
        <div className="text-center">
          <div className="text-6xl mb-4 text-gray-600">?</div>
          <h1 className="text-2xl font-syne font-bold text-white mb-2">Asset Not Found</h1>
          <p className="text-gray-400 mb-6">
            Token #{params.tokenId} does not exist on-chain.
          </p>
          <a href="/" className="text-[#00D68F] hover:underline text-sm">
            Back to TAG IT Verify
          </a>
        </div>
      </main>
    );
  }

  const state = STATES[asset.state] || STATES[0];
  const isAuthentic = asset.state >= 1 && asset.state <= 4;
  const arbiscanUrl = `https://sepolia.arbiscan.io/address/${CONTRACT_ADDRESS}`;
  const displayName = asset.productName || `Token #${params.tokenId}`;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "#000" }}>
      <div className="w-full max-w-[420px] py-[52px] px-5">

        {/* Animated Checkmark Ring */}
        <div className="flex justify-center mb-6 animate-scaleIn">
          <div className="relative w-[100px] h-[100px]">
            <div
              className="absolute inset-0 rounded-full animate-glowPulse"
              style={{
                background: isAuthentic
                  ? "radial-gradient(circle, rgba(0,214,143,0.25) 0%, transparent 70%)"
                  : "radial-gradient(circle, rgba(251,191,36,0.25) 0%, transparent 70%)",
              }}
            />
            <div
              className="absolute inset-0 rounded-full"
              style={{
                border: `3px solid ${isAuthentic ? "#00D68F" : "#fbbf24"}`,
                opacity: 0.3,
              }}
            />
            <div className="absolute inset-[8px] rounded-full flex items-center justify-center"
              style={{ background: isAuthentic ? "rgba(0,214,143,0.12)" : "rgba(251,191,36,0.12)" }}
            >
              <span className="text-4xl" style={{ color: isAuthentic ? "#00D68F" : "#fbbf24" }}>
                {isAuthentic ? "\u2713" : "\u26A0"}
              </span>
            </div>
          </div>
        </div>

        {/* Status Block */}
        <div className="text-center mb-4 animate-fadeUp" style={{ animationDelay: "0.15s" }}>
          <h1 className="font-syne text-[38px] font-bold leading-tight" style={{ color: isAuthentic ? "#00D68F" : "#fbbf24" }}>
            {isAuthentic ? "Authentic" : "Warning"}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {isAuthentic ? "This product is verified on-chain" : STATE_DESCRIPTIONS[asset.state] || ""}
          </p>
        </div>

        {/* State Pill */}
        <div className="flex justify-center mb-8 animate-fadeUp" style={{ animationDelay: "0.25s" }}>
          <div className={`inline-flex items-center gap-2 px-5 py-2 rounded-full border ${state.bg} ${state.border}`}>
            <span
              className="w-2 h-2 rounded-full animate-pulse-dot"
              style={asset.state === 2 ? { background: "#9B6DFF" } : undefined}
            />
            <span className={`text-sm font-bold tracking-wider ${state.text}`}>
              {state.label}
            </span>
          </div>
        </div>

        {/* Data Card */}
        <div
          className="rounded-2xl border border-white/10 p-5 space-y-0 mb-5 animate-fadeUp"
          style={{ background: "rgba(255,255,255,0.03)", animationDelay: "0.35s" }}
        >
          {/* Product */}
          <div className="flex justify-between items-center py-3">
            <span className="text-gray-500 text-sm">Product</span>
            <span className="font-mono text-sm font-semibold" style={{ color: "#F0A500" }}>
              {displayName}
            </span>
          </div>

          <div className="border-t border-white/5" />

          {/* Owner */}
          <div className="flex justify-between items-center py-3">
            <span className="text-gray-500 text-sm">Owner</span>
            <span className="text-white text-sm font-mono">
              {truncateAddress(asset.owner)}
            </span>
          </div>

          {/* MSRP (conditional) */}
          {asset.msrp && (
            <>
              <div className="border-t border-white/5" />
              <div className="flex justify-between items-center py-3">
                <span className="text-gray-500 text-sm">MSRP</span>
                <span className="font-mono text-sm font-semibold" style={{ color: "#00E5CC" }}>
                  {asset.msrp}
                </span>
              </div>
            </>
          )}

          <div className="border-t border-white/5" />

          {/* Registered */}
          <div className="flex justify-between items-center py-3">
            <span className="text-gray-500 text-sm">Registered</span>
            <span className="text-white text-sm">
              {formatTimestamp(asset.timestamp)}
            </span>
          </div>

          <div className="border-t border-white/5" />

          {/* Chain */}
          <div className="flex justify-between items-center py-3">
            <span className="text-gray-500 text-sm">Chain</span>
            <span className="text-white text-sm inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: "#28A0F0", boxShadow: "0 0 6px #28A0F0" }} />
              Arbitrum Sepolia
            </span>
          </div>
        </div>

        {/* Security Strip */}
        <div className="flex items-center justify-center gap-2 mb-5 animate-fadeUp" style={{ animationDelay: "0.45s" }}>
          <span className="text-sm">&#x1F512;</span>
          <span className="text-xs" style={{ color: "#00D68F" }}>
            Cryptographically secured on Arbitrum
          </span>
        </div>

        {/* Arbiscan Button */}
        <a
          href={arbiscanUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-white/10 text-gray-300 text-sm hover:bg-white/5 transition-colors animate-fadeUp"
          style={{ background: "rgba(255,255,255,0.03)", animationDelay: "0.55s" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          View on Arbiscan
          <span className="text-gray-500">{"\u2197"}</span>
        </a>

        {/* Footer */}
        <div className="text-center mt-10 space-y-2 animate-fadeUp" style={{ animationDelay: "0.65s" }}>
          <p className="text-gray-600 text-xs">
            Powered by <span className="text-gray-500">TAG IT Network</span>
          </p>
          <div className="flex items-center justify-center gap-1.5">
            <span className="text-gray-600 text-xs">Secured by</span>
            <svg width="16" height="18" viewBox="0 0 40 46" fill="none" className="inline-block">
              <path d="M20.0975 0.440186L39.295 11.522V33.686L20.0975 44.768L0.9 33.686V11.522L20.0975 0.440186Z" fill="#213147" />
              <path d="M24.168 27.574L28.378 37.738L32.026 35.608L26.702 23.128L24.168 27.574Z" fill="#12AAFF" />
              <path d="M20.0975 14.384L13.184 28.866L16.832 31.002L20.0975 23.608L24.168 27.574L26.702 23.128L20.0975 14.384Z" fill="#12AAFF" />
              <path d="M8.168 35.608L11.816 37.738L16.026 27.574L13.492 23.128L8.168 35.608Z" fill="white" />
              <path d="M20.0975 14.384L13.492 23.128L16.026 27.574L20.0975 23.608V14.384Z" fill="white" />
              <path d="M5.244 33.018V13.19L20.0975 4.276L34.951 13.19V33.018L20.0975 41.932L5.244 33.018Z" stroke="#9DCCED" strokeWidth="1.2" fill="none" />
            </svg>
            <span className="text-xs font-semibold" style={{ color: "#12AAFF" }}>Arbitrum</span>
          </div>
        </div>

      </div>
    </main>
  );
}
