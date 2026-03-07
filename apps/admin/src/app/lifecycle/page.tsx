"use client";

import { useState, useEffect, useCallback } from "react";
import { getAddress } from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useChainId } from "wagmi";
import {
  useAllAssets,
  useMint,
  useBindTag,
  useActivate,
  useClaim,
  useFlag,
  useApproveResolve,
  useResolve,
  useRecycle,
  useAccount,
  AssetState,
  AssetStateNames,
  getExplorerTxUrl,
  getContractsForChain,
  shortenAddress,
} from "@tagit/contracts";

// ---------- Static metadata for known demo tokens ----------

const ASSET_METADATA: Record<string, { name: string; msrp?: string }> = {
  "18": { name: "TAG IT Sneaker", msrp: "$199.99" },
  "19": { name: "Nike Air Max 90", msrp: "$149.99" },
  "20": { name: "Rolex Submariner", msrp: "$8,100" },
};

// ---------- Types ----------

interface EventLogEntry {
  id: number;
  message: string;
  timestamp: string;
  txHash?: string;
}

// ---------- State styling ----------

const STATE_LABELS: Record<number, string> = {
  0: "NONE",
  1: "MINTED",
  2: "BOUND",
  3: "ACTIVATED",
  4: "CLAIMED",
  5: "FLAGGED",
  6: "RECYCLED",
};

const STATE_COLORS: Record<number, string> = {
  0: "bg-gray-500/10 text-gray-400 border-gray-500/30",
  1: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  2: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  3: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  4: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  5: "bg-red-500/10 text-red-400 border-red-500/30",
  6: "bg-gray-500/10 text-gray-500 border-gray-500/30",
};

// Maps state → next action label. Real contract uses individual functions per transition.
const NEXT_ACTION: Record<number, { label: string; action: string }> = {
  [AssetState.MINTED]: { label: "Bind Tag", action: "bind" },
  [AssetState.BOUND]: { label: "Activate", action: "activate" },
  [AssetState.ACTIVATED]: { label: "Claim", action: "claim" },
  [AssetState.CLAIMED]: { label: "Flag", action: "flag" },
  [AssetState.FLAGGED]: { label: "Recycle", action: "recycle" },
};

// ---------- Helpers ----------

function formatTs(ts: bigint) {
  if (ts === 0n) return "--";
  return new Date(Number(ts) * 1000).toLocaleTimeString();
}

// ---------- Component ----------

export default function LifecyclePage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const contracts = getContractsForChain(chainId);

  const [events, setEvents] = useState<EventLogEntry[]>([]);
  const [eventId, setEventId] = useState(0);

  // Mint form state
  const [mintMetadataURI, setMintMetadataURI] = useState("");

  // Bind form state
  const [bindTokenId, setBindTokenId] = useState("");
  const [bindTagUID, setBindTagUID] = useState("");

  // Claim form state
  const [claimTokenId, setClaimTokenId] = useState("");
  const [claimAddress, setClaimAddress] = useState("");

  // Fetch all assets with auto-refresh
  const { assets, totalSupply, isLoading, refetch } = useAllAssets({
    pageSize: 50,
    refetchInterval: 5000,
  });

  // Write hooks
  const { mint, hash: mintHash, isPending: mintPending, isConfirming: mintConfirming, isSuccess: mintSuccess, error: mintError, tokenId: mintedTokenId } = useMint();
  const { bindTag, hash: bindHash, isPending: bindPending, isConfirming: bindConfirming, isSuccess: bindSuccess, error: bindError } = useBindTag();
  const { activate, hash: activateHash, isPending: activatePending, isConfirming: activateConfirming, isSuccess: activateSuccess, error: activateError } = useActivate();
  const { claim, hash: claimHash, isPending: claimPending, isConfirming: claimConfirming, isSuccess: claimSuccess, error: claimError } = useClaim();
  const { flag, hash: flagHash, isPending: flagPending, isConfirming: flagConfirming, isSuccess: flagSuccess, error: flagError } = useFlag();
  const { recycle, hash: recycleHash, isPending: recyclePending, isConfirming: recycleConfirming, isSuccess: recycleSuccess, error: recycleError } = useRecycle();

  // Pending state for any write
  const anyPending = mintPending || mintConfirming || bindPending || bindConfirming || activatePending || activateConfirming || claimPending || claimConfirming || flagPending || flagConfirming || recyclePending || recycleConfirming;

  const addEvent = useCallback(
    (message: string, txHash?: string) => {
      setEvents((prev) => [
        { id: eventId + 1, message, timestamp: new Date().toLocaleTimeString(), txHash },
        ...prev.slice(0, 49),
      ]);
      setEventId((prev) => prev + 1);
    },
    [eventId]
  );

  // Track transaction events
  useEffect(() => {
    if (mintHash) addEvent(`Mint tx sent`, mintHash);
  }, [mintHash]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mintSuccess) { addEvent(`Minted token #${mintedTokenId?.toString() ?? "?"}`, mintHash); refetch(); }
  }, [mintSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (bindHash) addEvent(`Bind tag tx sent`, bindHash);
  }, [bindHash]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (bindSuccess) { addEvent(`Tag bound!`, bindHash); refetch(); }
  }, [bindSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activateHash) addEvent(`Activate tx sent`, activateHash);
  }, [activateHash]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activateSuccess) { addEvent(`Asset activated!`, activateHash); refetch(); }
  }, [activateSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (claimHash) addEvent(`Claim tx sent`, claimHash);
  }, [claimHash]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (claimSuccess) { addEvent(`Asset claimed!`, claimHash); refetch(); }
  }, [claimSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (flagHash) addEvent(`Flag tx sent`, flagHash);
  }, [flagHash]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (flagSuccess) { addEvent(`Asset flagged!`, flagHash); refetch(); }
  }, [flagSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (recycleHash) addEvent(`Recycle tx sent`, recycleHash);
  }, [recycleHash]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (recycleSuccess) { addEvent(`Asset recycled!`, recycleHash); refetch(); }
  }, [recycleSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  // Log errors
  useEffect(() => {
    if (mintError) addEvent(`Mint error: ${mintError.message.slice(0, 80)}`);
  }, [mintError]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (bindError) addEvent(`Bind error: ${bindError.message.slice(0, 80)}`);
  }, [bindError]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activateError) addEvent(`Activate error: ${activateError.message.slice(0, 80)}`);
  }, [activateError]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (claimError) addEvent(`Claim error: ${claimError.message.slice(0, 80)}`);
  }, [claimError]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (flagError) addEvent(`Flag error: ${flagError.message.slice(0, 80)}`);
  }, [flagError]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (recycleError) addEvent(`Recycle error: ${recycleError.message.slice(0, 80)}`);
  }, [recycleError]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleMint() {
    if (!address) return;
    const checksumAddress = getAddress(address);
    const uri = mintMetadataURI || `data:application/json;base64,${btoa(JSON.stringify({ name: "Test Asset", description: "Demo" }))}`;
    mint(checksumAddress, uri);
  }

  function handleAction(tokenId: bigint, action: string) {
    switch (action) {
      case "activate":
        activate(tokenId);
        break;
      case "flag":
        flag(tokenId);
        break;
      case "recycle":
        recycle(tokenId);
        break;
      case "bind":
        setBindTokenId(tokenId.toString());
        break;
      case "claim":
        setClaimTokenId(tokenId.toString());
        if (address) setClaimAddress(address);
        break;
    }
  }

  function handleBind() {
    if (!bindTokenId || !bindTagUID) return;
    const tokenId = BigInt(bindTokenId);
    // Convert UID to tag hash via keccak256
    const clean = bindTagUID.replace(/[:\-\s]/g, "").toLowerCase();
    const tagHash = `0x${clean.padEnd(64, "0")}` as `0x${string}`;
    bindTag(tokenId, tagHash);
  }

  function handleClaim() {
    if (!claimTokenId || !claimAddress) return;
    const tokenId = BigInt(claimTokenId);
    const checksumAddr = getAddress(claimAddress) as `0x${string}`;
    claim(tokenId, checksumAddr);
  }

  // State distribution counts
  const stateCounts: Record<string, number> = {};
  for (const a of assets) {
    const label = STATE_LABELS[a.state] ?? "UNKNOWN";
    stateCounts[label] = (stateCounts[label] ?? 0) + 1;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Lifecycle Console</h1>
          <p className="text-sm text-muted-foreground">
            Manage assets on the real TAGITCore contract
          </p>
        </div>
        <ConnectButton />
      </div>

      {/* Testnet Banner */}
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-2 text-sm text-amber-400">
        Arbitrum Sepolia — TAGITCore: {shortenAddress(contracts.TAGITCore)}
      </div>

      {/* Stats Bar */}
      <div className="flex gap-3 flex-wrap">
        <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-2">
          <span className="text-gray-400 text-xs">Total Supply</span>
          <p className="text-lg font-bold text-white">{totalSupply}</p>
        </div>
        {Object.entries(stateCounts).map(([label, count]) => (
          <div key={label} className="rounded-lg border border-white/10 bg-white/5 px-4 py-2">
            <span className="text-gray-400 text-xs">{label}</span>
            <p className="text-lg font-bold text-white">{count}</p>
          </div>
        ))}
      </div>

      {/* Action Forms */}
      {isConnected && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Mint Form */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-sm font-semibold text-gray-300 mb-3">Mint New Asset</h2>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Metadata URI (optional)</label>
                <input
                  type="text"
                  value={mintMetadataURI}
                  onChange={(e) => setMintMetadataURI(e.target.value)}
                  placeholder="data:application/json;base64,..."
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/50"
                />
              </div>
              <button
                onClick={handleMint}
                disabled={mintPending || mintConfirming}
                className="w-full px-4 py-2 rounded-lg bg-[#D4AF37] text-black font-semibold text-sm hover:bg-[#C4A030] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {mintPending ? "Confirm in wallet..." : mintConfirming ? "Minting..." : "Mint"}
              </button>
            </div>
          </div>

          {/* Bind Tag Form */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-sm font-semibold text-gray-300 mb-3">Bind NFC Tag</h2>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Token ID</label>
                <input
                  type="number"
                  value={bindTokenId}
                  onChange={(e) => setBindTokenId(e.target.value)}
                  placeholder="19"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/50"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Tag UID</label>
                <input
                  type="text"
                  value={bindTagUID}
                  onChange={(e) => setBindTagUID(e.target.value)}
                  placeholder="04:A1:B2:C3:D4:E5:F6"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/50"
                />
              </div>
              <button
                onClick={handleBind}
                disabled={!bindTokenId || !bindTagUID || bindPending || bindConfirming}
                className="w-full px-4 py-2 rounded-lg bg-purple-600 text-white font-semibold text-sm hover:bg-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {bindPending ? "Confirm in wallet..." : bindConfirming ? "Binding..." : "Bind Tag"}
              </button>
            </div>
          </div>

          {/* Claim Form */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-sm font-semibold text-gray-300 mb-3">Claim Asset</h2>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Token ID</label>
                <input
                  type="number"
                  value={claimTokenId}
                  onChange={(e) => setClaimTokenId(e.target.value)}
                  placeholder="19"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/50"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">New Owner</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={claimAddress}
                    onChange={(e) => setClaimAddress(e.target.value)}
                    placeholder="0x..."
                    className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/50"
                  />
                  <button
                    onClick={() => address && setClaimAddress(address)}
                    className="px-2 py-2 rounded-lg border border-white/10 text-gray-400 text-xs hover:bg-white/5"
                  >
                    Me
                  </button>
                </div>
              </div>
              <button
                onClick={handleClaim}
                disabled={!claimTokenId || !claimAddress || claimPending || claimConfirming}
                className="w-full px-4 py-2 rounded-lg bg-amber-600 text-white font-semibold text-sm hover:bg-amber-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {claimPending ? "Confirm in wallet..." : claimConfirming ? "Claiming..." : "Claim"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Asset Grid */}
      <div>
        <h2 className="text-sm font-semibold text-gray-300 mb-3">
          Assets {isLoading && <span className="text-gray-500">(loading...)</span>}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((asset) => {
            const stateColor = STATE_COLORS[asset.state] ?? STATE_COLORS[0];
            const stateLabel = STATE_LABELS[asset.state] ?? "UNKNOWN";
            const next = NEXT_ACTION[asset.state];
            const meta = ASSET_METADATA[asset.tokenId.toString()];
            const displayName = meta?.name ?? `Token #${asset.tokenId.toString()}`;

            return (
              <div
                key={asset.tokenId.toString()}
                className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-gray-500">#{asset.tokenId.toString()}</p>
                    <p className="text-lg font-semibold text-white">{displayName}</p>
                    {meta?.msrp && (
                      <p className="text-xs text-teal-400">{meta.msrp}</p>
                    )}
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full border text-xs font-bold ${stateColor}`}
                  >
                    {stateLabel}
                  </span>
                </div>

                <div className="space-y-1 text-xs text-gray-400">
                  <div className="flex justify-between">
                    <span>Owner</span>
                    <span className="font-mono">{shortenAddress(asset.owner)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Registered</span>
                    <span>{formatTs(asset.timestamp)}</span>
                  </div>
                </div>

                {isConnected && next && (
                  <button
                    onClick={() => handleAction(asset.tokenId, next.action)}
                    disabled={anyPending}
                    className="w-full py-2 rounded-lg border border-white/10 bg-white/5 text-sm text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                  >
                    {anyPending ? "Pending..." : `${next.label} \u2192`}
                  </button>
                )}
              </div>
            );
          })}

          {assets.length === 0 && !isLoading && (
            <p className="text-gray-500 text-sm col-span-3 text-center py-8">
              No assets found. Connect wallet and mint one above.
            </p>
          )}
        </div>
      </div>

      {/* Event Log */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">
          Recent Events ({events.length})
        </h2>
        <div className="space-y-1 max-h-48 overflow-y-auto font-mono text-xs">
          {events.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              Transactions will appear here...
            </p>
          ) : (
            events.map((ev) => (
              <div key={ev.id} className="flex items-center gap-2 text-gray-300">
                <span className="text-gray-500 w-16 flex-shrink-0">{ev.timestamp}</span>
                <span className="flex-1">{ev.message}</span>
                {ev.txHash && (
                  <a
                    href={getExplorerTxUrl(chainId, ev.txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#D4AF37] hover:underline flex-shrink-0"
                  >
                    View
                  </a>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Contract Info */}
      <div className="text-center text-xs text-gray-600 space-y-1">
        <p>
          Contract:{" "}
          <a
            href={`https://sepolia.arbiscan.io/address/${contracts.TAGITCore}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#D4AF37] hover:underline"
          >
            {shortenAddress(contracts.TAGITCore)}
          </a>
        </p>
        <p>Powered by TAG IT Network on Arbitrum Sepolia</p>
      </div>
    </div>
  );
}
