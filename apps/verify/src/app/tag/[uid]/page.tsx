"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getAsset, getTokenByTag, getTagByToken, uidToTagHash, CONTRACT_ADDRESS } from "@/lib/contract";
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
  tagHash: string;
}

export default function TagVerifyPage() {
  const params = useParams<{ uid: string }>();
  const [asset, setAsset] = useState<AssetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const tagHash = uidToTagHash(params.uid);
        const tokenId = await getTokenByTag(tagHash) as bigint;

        if (!tokenId || tokenId === 0n) {
          setError("No asset is bound to this NFC tag.");
          return;
        }

        const result = await getAsset(tokenId);

        setAsset({
          tokenId,
          state: result.state,
          owner: result.owner,
          timestamp: result.timestamp,
          tagHash,
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
      <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#0a0a0a]">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-[#D4AF37]" />
              <span className="text-[#D4AF37] text-xs font-semibold tracking-widest uppercase">
                TAG IT Network
              </span>
            </div>
            <p className="text-gray-500 text-xs mt-1">NFC Verification</p>
          </div>
          <div className="text-center mb-8">
            <p className="text-gray-400 text-sm">Reading NFC tag...</p>
            <p className="text-gray-600 text-xs font-mono mt-1">{formattedUid}</p>
          </div>
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 bg-white/10 rounded mx-auto" />
            <div className="flex justify-center">
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
        </div>
      </main>
    );
  }

  if (error || !asset) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#0a0a0a]">
        <div className="text-center max-w-sm">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-[#D4AF37]" />
            <span className="text-[#D4AF37] text-xs font-semibold tracking-widest uppercase">
              TAG IT Network
            </span>
          </div>
          <div className="text-5xl mb-4">?</div>
          <h1 className="text-2xl font-bold text-white mb-2">Tag Not Found</h1>
          <p className="text-gray-400 text-sm mb-2">
            {error || "This NFC tag is not registered on-chain."}
          </p>
          <p className="text-gray-600 text-xs font-mono mb-6">{formattedUid}</p>
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
  const isAuthentic = asset.state >= 2 && asset.state <= 4;

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
          <p className="text-gray-500 text-xs">NFC Verification</p>
        </div>

        {/* Authenticity Verdict */}
        {isAuthentic ? (
          <div className="text-center mb-6">
            <div className="text-5xl mb-2">&#x2713;</div>
            <h1 className="text-2xl font-bold text-emerald-400">Authentic</h1>
            <p className="text-gray-500 text-sm mt-1">
              This product is verified on-chain
            </p>
          </div>
        ) : (
          <div className="text-center mb-6">
            <div className="text-5xl mb-2">&#x26A0;</div>
            <h1 className="text-2xl font-bold text-amber-400">
              {asset.state === 1 ? "Not Yet Bound" : asset.state === 5 ? "Flagged" : asset.state === 6 ? "Retired" : "Unknown"}
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              {description}
            </p>
          </div>
        )}

        {/* State Badge */}
        <div className="flex justify-center mb-8">
          <div
            className={`
              px-6 py-3 rounded-full border
              ${state.bg} ${state.text} ${state.border}
              shadow-lg ${state.glow}
              text-lg font-bold tracking-wider
            `}
          >
            {state.label}
          </div>
        </div>

        {/* Details Card */}
        <div className="bg-white/5 rounded-xl border border-white/10 p-4 space-y-3 mb-6">
          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-sm">Token</span>
            <span className="text-white text-sm font-mono">
              #{asset.tokenId.toString()}
            </span>
          </div>
          <div className="border-t border-white/5" />
          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-sm">Owner</span>
            <span className="text-white text-sm font-mono">
              {truncateAddress(asset.owner)}
            </span>
          </div>
          <div className="border-t border-white/5" />
          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-sm">NFC Tag</span>
            <span className="text-emerald-400 text-sm font-mono">
              {formattedUid}
            </span>
          </div>
          <div className="border-t border-white/5" />
          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-sm">Registered</span>
            <span className="text-white text-sm">
              {formatTimestamp(asset.timestamp)}
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
          View on Arbiscan
        </a>

        {/* Footer */}
        <p className="text-center text-gray-600 text-xs mt-8">
          Powered by TAG IT Network
        </p>
      </div>
    </main>
  );
}
