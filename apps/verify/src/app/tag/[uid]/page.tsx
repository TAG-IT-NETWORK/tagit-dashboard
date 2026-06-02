"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
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

function formatUid(uid: string): string {
  const clean = uid.replace(/[:\-\s]/g, "").toUpperCase();
  return clean.match(/.{1,2}/g)?.join(":") || clean;
}

interface AssetData {
  tokenId: bigint;
  state: number;
  owner: string;
  timestamp: bigint;
  productName?: string;
  msrp?: string;
}

export default function TagVerifyPage() {
  const params = useParams<{ uid: string }>();
  const [asset, setAsset] = useState<AssetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        // For the hackathon demo, NFC chips are programmed with /asset/{id} URLs.
        // This /tag/{uid} route is a fallback — try parsing the UID as a token ID.
        const tokenId = BigInt(params.uid);
        const result = await getAsset(tokenId);

        if (result.state === 0) {
          setError("No asset found for this NFC tag.");
          return;
        }

        const meta = getMetadataForToken(tokenId.toString());
        setAsset({
          tokenId,
          state: result.state,
          owner: result.owner,
          timestamp: result.timestamp,
          productName: meta.productName,
          msrp: meta.msrp,
        });
      } catch {
        setError("Could not look up this NFC tag on-chain.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.uid]);

  const formattedUid = formatUid(params.uid);

  if (loading) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "#000" }}>
        <div className="w-full max-w-[420px] py-[52px] px-5">
          <div className="text-center mb-6">
            <p className="text-gray-400 text-sm">Reading NFC tag...</p>
            <p className="text-gray-600 text-xs font-mono mt-1">{formattedUid}</p>
          </div>
          <div className="animate-pulse">
            <div className="flex justify-center mb-6">
              <div className="w-24 h-24 rounded-full bg-white/5" />
            </div>
            <div className="h-8 w-32 bg-white/10 rounded mx-auto mb-2" />
            <div className="h-4 w-48 bg-white/5 rounded mx-auto mb-6" />
            <div className="bg-white/5 rounded-2xl p-5 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex justify-between">
                  <div className="h-4 w-16 bg-white/10 rounded" />
                  <div className="h-4 w-24 bg-white/10 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (error || !asset) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "#000" }}>
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4 text-gray-600">?</div>
          <h1 className="text-2xl font-syne font-bold text-white mb-2">Tag Not Found</h1>
          <p className="text-gray-400 text-sm mb-2">
            {error || "This NFC tag is not registered on-chain."}
          </p>
          <p className="text-gray-600 text-xs font-mono mb-6">{formattedUid}</p>
          <a href="/" className="text-[#00D68F] hover:underline text-sm">
            Back to TAG IT Verify
          </a>
        </div>
      </main>
    );
  }

  const state = STATES[asset.state] || STATES[0];
  const isAuthentic = asset.state >= 1 && asset.state <= 4;
  const basescanUrl = `https://sepolia.basescan.org/address/${CONTRACT_ADDRESS}`;
  const displayName = asset.productName || `Token #${asset.tokenId.toString()}`;

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
            {isAuthentic ? "Authentic" : asset.state === 1 ? "Not Yet Bound" : asset.state === 5 ? "Flagged" : asset.state === 6 ? "Retired" : "Warning"}
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
          <div className="flex justify-between items-center py-3">
            <span className="text-gray-500 text-sm">Product</span>
            <span className="font-mono text-sm font-semibold" style={{ color: "#F0A500" }}>
              {displayName}
            </span>
          </div>

          <div className="border-t border-white/5" />

          <div className="flex justify-between items-center py-3">
            <span className="text-gray-500 text-sm">Owner</span>
            <span className="text-white text-sm font-mono">
              {truncateAddress(asset.owner)}
            </span>
          </div>

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

          <div className="flex justify-between items-center py-3">
            <span className="text-gray-500 text-sm">Registered</span>
            <span className="text-white text-sm">
              {formatTimestamp(asset.timestamp)}
            </span>
          </div>

          <div className="border-t border-white/5" />

          <div className="flex justify-between items-center py-3">
            <span className="text-gray-500 text-sm">Chain</span>
            <span className="text-white text-sm inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: "#0052FF", boxShadow: "0 0 6px #0052FF" }} />
              Base Sepolia
            </span>
          </div>
        </div>

        {/* Security Strip */}
        <div className="flex items-center justify-center gap-2 mb-5 animate-fadeUp" style={{ animationDelay: "0.45s" }}>
          <span className="text-sm">&#x1F512;</span>
          <span className="text-xs" style={{ color: "#00D68F" }}>
            Cryptographically secured on Base
          </span>
        </div>

        {/* Arbiscan Button */}
        <a
          href={basescanUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-white/10 text-gray-300 text-sm hover:bg-white/5 transition-colors animate-fadeUp"
          style={{ background: "rgba(255,255,255,0.03)", animationDelay: "0.55s" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          View on BaseScan
          <span className="text-gray-500">{"\u2197"}</span>
        </a>

        {/* Footer */}
        <div className="text-center mt-10 space-y-2 animate-fadeUp" style={{ animationDelay: "0.65s" }}>
          <p className="text-gray-600 text-xs">
            Powered by <span className="text-gray-500">TAG IT Network</span>
          </p>
          <div className="flex items-center justify-center gap-1.5">
            <span className="text-gray-600 text-xs">Secured by</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="inline-block">
              <circle cx="12" cy="12" r="12" fill="#0052FF" />
              <path d="M12 21.6c5.302 0 9.6-4.298 9.6-9.6 0-5.302-4.298-9.6-9.6-9.6-5.034 0-9.16 3.873-9.566 8.8H15.6v1.6H2.434C2.84 17.727 6.966 21.6 12 21.6z" fill="#fff" />
            </svg>
            <span className="text-xs font-semibold" style={{ color: "#0052FF" }}>Base</span>
          </div>
        </div>

      </div>
    </main>
  );
}
