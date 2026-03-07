"use client";

import { useState, useEffect, useCallback } from "react";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  TAGITCoreDemoABI,
  DEMO_CONTRACT_ADDRESS,
  STATE_LABELS,
  STATE_COLORS,
  NEXT_STATE,
} from "@/lib/demo-abi";

// ---------- Types ----------

interface Asset {
  tokenId: bigint;
  name: string;
  state: number;
  owner: string;
  mintedAt: bigint;
  lastUpdated: bigint;
}

interface EventLogEntry {
  id: number;
  message: string;
  timestamp: string;
  txHash?: string;
}

// ---------- Helpers ----------

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function parseAssetName(raw: string): { name: string; msrp?: string } {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.name === "string") {
      return { name: parsed.name, msrp: parsed.msrp };
    }
  } catch {}
  return { name: raw };
}

function formatTs(ts: bigint) {
  if (ts === 0n) return "--";
  return new Date(Number(ts) * 1000).toLocaleTimeString();
}

// ---------- Component ----------

export default function LifecyclePage() {
  const { isConnected } = useAccount();
  const [events, setEvents] = useState<EventLogEntry[]>([]);
  const [eventId, setEventId] = useState(0);

  // Mint form state
  const [mintTokenId, setMintTokenId] = useState("");
  const [mintName, setMintName] = useState("");
  const [mintMsrp, setMintMsrp] = useState("");

  // Read token IDs
  const {
    data: tokenIds,
    refetch: refetchTokenIds,
  } = useReadContract({
    address: DEMO_CONTRACT_ADDRESS,
    abi: TAGITCoreDemoABI,
    functionName: "getTokenIds",
  });

  // Read all assets
  const { data: assetsRaw, refetch: refetchAssets } = useReadContracts({
    contracts: (tokenIds ?? []).map((id) => ({
      address: DEMO_CONTRACT_ADDRESS,
      abi: TAGITCoreDemoABI,
      functionName: "getAsset" as const,
      args: [id] as const,
    })),
  });

  const assets: Asset[] = (tokenIds ?? []).map((id, i) => {
    const result = assetsRaw?.[i]?.result as
      | [string, number, string, bigint, bigint]
      | undefined;
    return {
      tokenId: id,
      name: result?.[0] ?? "?",
      state: result?.[1] ?? 0,
      owner: result?.[2] ?? "0x0",
      mintedAt: result?.[3] ?? 0n,
      lastUpdated: result?.[4] ?? 0n,
    };
  });

  // Write: mint
  const {
    writeContract: writeMint,
    data: mintTxHash,
    isPending: isMinting,
    reset: resetMint,
  } = useWriteContract();

  const { isSuccess: mintConfirmed } = useWaitForTransactionReceipt({
    hash: mintTxHash,
  });

  // Write: changeState
  const {
    writeContract: writeChangeState,
    data: stateTxHash,
    isPending: isChangingState,
    reset: resetState,
  } = useWriteContract();

  const { isSuccess: stateConfirmed } = useWaitForTransactionReceipt({
    hash: stateTxHash,
  });

  // Refetch on confirmations
  useEffect(() => {
    if (mintConfirmed) {
      refetchTokenIds();
      refetchAssets();
      resetMint();
      setMintTokenId("");
      setMintName("");
      setMintMsrp("");
    }
  }, [mintConfirmed, refetchTokenIds, refetchAssets, resetMint]);

  useEffect(() => {
    if (stateConfirmed) {
      refetchAssets();
      resetState();
    }
  }, [stateConfirmed, refetchAssets, resetState]);

  // Auto-refresh every 5s
  useEffect(() => {
    const interval = setInterval(() => {
      refetchTokenIds();
      refetchAssets();
    }, 5000);
    return () => clearInterval(interval);
  }, [refetchTokenIds, refetchAssets]);

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

  // Track mint tx
  useEffect(() => {
    if (mintTxHash) addEvent(`Mint tx sent: ${mintTxHash.slice(0, 10)}...`, mintTxHash);
  }, [mintTxHash]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mintConfirmed && mintTxHash) addEvent(`Mint confirmed!`, mintTxHash);
  }, [mintConfirmed]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track state tx
  useEffect(() => {
    if (stateTxHash) addEvent(`State change tx: ${stateTxHash.slice(0, 10)}...`, stateTxHash);
  }, [stateTxHash]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (stateConfirmed && stateTxHash) addEvent(`State change confirmed!`, stateTxHash);
  }, [stateConfirmed]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleMint() {
    const id = BigInt(mintTokenId);
    // Encode name + msrp as JSON so verify page can parse both fields
    const metadata = mintMsrp
      ? JSON.stringify({ name: mintName, msrp: mintMsrp })
      : mintName;
    writeMint({
      address: DEMO_CONTRACT_ADDRESS,
      abi: TAGITCoreDemoABI,
      functionName: "mint",
      args: [id, metadata],
    });
  }

  function handleChangeState(tokenId: bigint, newState: number) {
    writeChangeState({
      address: DEMO_CONTRACT_ADDRESS,
      abi: TAGITCoreDemoABI,
      functionName: "changeState",
      args: [tokenId, newState],
    });
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
            Mint assets, advance states, observe on-chain changes
          </p>
        </div>
        <ConnectButton />
      </div>

      {/* Testnet Banner */}
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-2 text-sm text-amber-400">
        Arbitrum Sepolia Testnet — Demo Mode
      </div>

      {/* Stats Bar */}
      <div className="flex gap-3 flex-wrap">
        <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-2">
          <span className="text-gray-400 text-xs">Total</span>
          <p className="text-lg font-bold text-white">{assets.length}</p>
        </div>
        {Object.entries(stateCounts).map(([label, count]) => (
          <div key={label} className="rounded-lg border border-white/10 bg-white/5 px-4 py-2">
            <span className="text-gray-400 text-xs">{label}</span>
            <p className="text-lg font-bold text-white">{count}</p>
          </div>
        ))}
      </div>

      {/* Mint Form */}
      {isConnected && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Mint New Asset</h2>
          <div className="flex gap-3 items-end">
            <div className="flex-shrink-0">
              <label className="text-xs text-gray-500 block mb-1">Token ID</label>
              <input
                type="number"
                value={mintTokenId}
                onChange={(e) => setMintTokenId(e.target.value)}
                placeholder="4"
                className="w-20 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/50"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500 block mb-1">Product Name</label>
              <input
                type="text"
                value={mintName}
                onChange={(e) => setMintName(e.target.value)}
                placeholder="Nike Air Max 90"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/50"
              />
            </div>
            <div className="flex-shrink-0">
              <label className="text-xs text-gray-500 block mb-1">MSRP</label>
              <input
                type="text"
                value={mintMsrp}
                onChange={(e) => setMintMsrp(e.target.value)}
                placeholder="$149.99"
                className="w-28 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/50"
              />
            </div>
            <button
              onClick={handleMint}
              disabled={!mintTokenId || !mintName || isMinting}
              className="px-6 py-2 rounded-lg bg-[#D4AF37] text-black font-semibold text-sm hover:bg-[#C4A030] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isMinting ? "Minting..." : "Mint"}
            </button>
          </div>
        </div>
      )}

      {/* Asset Grid */}
      <div>
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Assets</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((asset) => {
            const stateColor = STATE_COLORS[asset.state] ?? STATE_COLORS[0];
            const stateLabel = STATE_LABELS[asset.state] ?? "UNKNOWN";
            const next = NEXT_STATE[asset.state];

            return (
              <div
                key={asset.tokenId.toString()}
                className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-gray-500">#{asset.tokenId.toString()}</p>
                    <p className="text-lg font-semibold text-white">{parseAssetName(asset.name).name}</p>
                    {parseAssetName(asset.name).msrp && (
                      <p className="text-xs text-teal-400">{parseAssetName(asset.name).msrp}</p>
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
                    <span className="font-mono">{truncateAddress(asset.owner)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Minted</span>
                    <span>{formatTs(asset.mintedAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Updated</span>
                    <span>{formatTs(asset.lastUpdated)}</span>
                  </div>
                </div>

                {isConnected && next && (
                  <button
                    onClick={() => handleChangeState(asset.tokenId, next.value)}
                    disabled={isChangingState}
                    className="w-full py-2 rounded-lg border border-white/10 bg-white/5 text-sm text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                  >
                    {isChangingState ? "Pending..." : `${next.label} →`}
                  </button>
                )}
              </div>
            );
          })}

          {assets.length === 0 && (
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
                    href={`https://sepolia.arbiscan.io/tx/${ev.txHash}`}
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
            href={`https://sepolia.arbiscan.io/address/${DEMO_CONTRACT_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#D4AF37] hover:underline"
          >
            {truncateAddress(DEMO_CONTRACT_ADDRESS)}
          </a>
        </p>
        <p>Powered by TAG IT Network on Arbitrum Sepolia</p>
      </div>
    </div>
  );
}
