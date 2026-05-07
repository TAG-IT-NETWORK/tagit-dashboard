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
  brand?: string;
  description?: string;
  image?: string;
  images?: string[];
  msrp?: string;
  sku?: string;
  origin?: string;
  size?: string;
  flags?: number;
}

// w3s.link is generally faster than the public Pinata gateway and
// doesn't have the same per-IP rate limits.
const IPFS_GATEWAY = "https://w3s.link/ipfs/";

function ipfsToHttp(uri?: string): string | undefined {
  if (!uri) return undefined;
  if (uri.startsWith("ipfs://")) return IPFS_GATEWAY + uri.slice("ipfs://".length);
  return uri;
}

interface RemoteMetadata {
  name?: string;
  brand?: string;
  description?: string;
  image?: string;
  images?: string[];
  msrp?: string;
  sku?: string;
  origin?: string;
  size?: string;
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
        const staticMeta = getMetadataForToken(params.tokenId);

        // ?meta=ipfs://Qm... query param wins; otherwise fall back to the
        // static map's `meta` pointer (so known tokens auto-load full metadata
        // even when the chip URL is just /asset/5 with no params).
        let remote: RemoteMetadata = {};
        const metaSource = searchParams.get("meta") || staticMeta.meta;
        if (metaSource) {
          const url = ipfsToHttp(metaSource);
          if (url) {
            try {
              // IPFS content is immutable by CID — safe (and much faster) to cache.
              const res = await fetch(url, { cache: "force-cache" });
              if (res.ok) remote = (await res.json()) as RemoteMetadata;
            } catch {
              // Ignore IPFS fetch errors — fall back to static + URL params
            }
          }
        }

        setAsset({
          state: result.state,
          owner: result.owner,
          timestamp: result.timestamp,
          productName:
            searchParams.get("name") || remote.name || staticMeta.productName || undefined,
          brand: searchParams.get("brand") || remote.brand || undefined,
          description: remote.description || undefined,
          image: ipfsToHttp(remote.image) || searchParams.get("image") || undefined,
          images: remote.images?.map((u) => ipfsToHttp(u)).filter((u): u is string => !!u),
          msrp: searchParams.get("msrp") || remote.msrp || staticMeta.msrp || undefined,
          sku: searchParams.get("sku") || remote.sku || undefined,
          origin: searchParams.get("origin") || remote.origin || undefined,
          size: remote.size || undefined,
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
      <main
        className="min-h-screen flex flex-col items-center justify-center px-4"
        style={{ background: "#000" }}
      >
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
      <main
        className="min-h-screen flex flex-col items-center justify-center px-4"
        style={{ background: "#000" }}
      >
        <div className="text-center">
          <div className="text-6xl mb-4 text-gray-600">?</div>
          <h1 className="text-2xl font-syne font-bold text-white mb-2">Asset Not Found</h1>
          <p className="text-gray-400 mb-6">Token #{params.tokenId} does not exist on-chain.</p>
          <a href="/" className="text-[#00D68F] hover:underline text-sm">
            Back to TAG IT Verify
          </a>
        </div>
      </main>
    );
  }

  const state = STATES[asset.state] || STATES[0];
  const isAuthentic = asset.state >= 1 && asset.state <= 4;
  const explorerUrl = `https://sepolia.basescan.org/address/${CONTRACT_ADDRESS}`;
  const displayName = asset.productName || `Token #${params.tokenId}`;

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "#000" }}
    >
      <div className="w-full max-w-[420px] py-[52px] px-5">
        {/* Product Image (single, compact) */}
        {asset.image && (
          <div
            className="mb-6 rounded-2xl overflow-hidden border border-white/10 animate-fadeUp flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.03)", height: 220 }}
          >
            <img
              src={asset.image}
              alt={asset.productName || `Token #${params.tokenId}`}
              className="max-h-full max-w-full object-contain"
              loading="eager"
              decoding="async"
              fetchPriority="high"
            />
          </div>
        )}

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
            <div
              className="absolute inset-[8px] rounded-full flex items-center justify-center"
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
          <h1
            className="font-syne text-[38px] font-bold leading-tight"
            style={{ color: isAuthentic ? "#00D68F" : "#fbbf24" }}
          >
            {isAuthentic ? "Authentic" : "Warning"}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {isAuthentic
              ? "This product is verified on-chain"
              : STATE_DESCRIPTIONS[asset.state] || ""}
          </p>
        </div>

        {/* State Pill */}
        <div
          className="flex justify-center mb-8 animate-fadeUp"
          style={{ animationDelay: "0.25s" }}
        >
          <div
            className={`inline-flex items-center gap-2 px-5 py-2 rounded-full border ${state.bg} ${state.border}`}
          >
            <span
              className="w-2 h-2 rounded-full animate-pulse-dot"
              style={asset.state === 2 ? { background: "#9B6DFF" } : undefined}
            />
            <span className={`text-sm font-bold tracking-wider ${state.text}`}>{state.label}</span>
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
            <span className="text-white text-sm font-mono">{truncateAddress(asset.owner)}</span>
          </div>

          {/* Brand (conditional) */}
          {asset.brand && (
            <>
              <div className="border-t border-white/5" />
              <div className="flex justify-between items-center py-3">
                <span className="text-gray-500 text-sm">Brand</span>
                <span className="text-white text-sm">{asset.brand}</span>
              </div>
            </>
          )}

          {/* SKU (conditional) */}
          {asset.sku && (
            <>
              <div className="border-t border-white/5" />
              <div className="flex justify-between items-center py-3">
                <span className="text-gray-500 text-sm">SKU</span>
                <span className="text-white text-sm font-mono">{asset.sku}</span>
              </div>
            </>
          )}

          {/* Origin (conditional) */}
          {asset.origin && (
            <>
              <div className="border-t border-white/5" />
              <div className="flex justify-between items-center py-3">
                <span className="text-gray-500 text-sm">Origin</span>
                <span className="text-white text-sm">{asset.origin}</span>
              </div>
            </>
          )}

          {/* Size (conditional) */}
          {asset.size && (
            <>
              <div className="border-t border-white/5" />
              <div className="flex justify-between items-center py-3">
                <span className="text-gray-500 text-sm">Size</span>
                <span className="text-white text-sm">{asset.size}</span>
              </div>
            </>
          )}

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
            <span className="text-white text-sm">{formatTimestamp(asset.timestamp)}</span>
          </div>

          <div className="border-t border-white/5" />

          {/* Chain */}
          <div className="flex justify-between items-center py-3">
            <span className="text-gray-500 text-sm">Chain</span>
            <span className="text-white text-sm inline-flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: "#0052FF", boxShadow: "0 0 6px #0052FF" }}
              />
              Base Sepolia
            </span>
          </div>
        </div>

        {/* Description (conditional) */}
        {asset.description && (
          <div
            className="rounded-2xl border border-white/10 p-5 mb-5 animate-fadeUp"
            style={{ background: "rgba(255,255,255,0.03)", animationDelay: "0.4s" }}
          >
            <p className="text-gray-400 text-sm leading-relaxed whitespace-pre-line">
              {asset.description}
            </p>
          </div>
        )}

        {/* Security Strip */}
        <div
          className="flex items-center justify-center gap-2 mb-5 animate-fadeUp"
          style={{ animationDelay: "0.45s" }}
        >
          <span className="text-sm">&#x1F512;</span>
          <span className="text-xs" style={{ color: "#00D68F" }}>
            Cryptographically secured on Base
          </span>
        </div>

        {/* Explorer Button */}
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-white/10 text-gray-300 text-sm hover:bg-white/5 transition-colors animate-fadeUp"
          style={{ background: "rgba(255,255,255,0.03)", animationDelay: "0.55s" }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          View on BaseScan
          <span className="text-gray-500">{"\u2197"}</span>
        </a>

        {/* Footer */}
        <div
          className="text-center mt-10 space-y-2 animate-fadeUp"
          style={{ animationDelay: "0.65s" }}
        >
          <p className="text-gray-600 text-xs">
            Powered by <span className="text-gray-500">TAG IT Network</span>
          </p>
          <div className="flex items-center justify-center gap-1.5">
            <span className="text-gray-600 text-xs">Secured by</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="inline-block">
              <circle cx="12" cy="12" r="12" fill="#0052FF" />
              <path
                d="M12 21.6c5.302 0 9.6-4.298 9.6-9.6 0-5.302-4.298-9.6-9.6-9.6-5.034 0-9.16 3.873-9.566 8.8H15.6v1.6H2.434C2.84 17.727 6.966 21.6 12 21.6z"
                fill="#fff"
              />
            </svg>
            <span className="text-xs font-semibold" style={{ color: "#0052FF" }}>
              Base
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
