"use client";

/**
 * On-chain audit trail for the Digital Twin Console.
 *
 * Reads the asset's StateChanged event history directly from chain and renders
 * a reverse-chronological timeline of every lifecycle transition (from -> to,
 * actor, time, tx). This is the real path the asset took — including any
 * recall/recovery branches — and doubles as the compliance/custody record.
 */
import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { useChainId, usePublicClient } from "wagmi";
import { AssetStateNames, getContractsForChain, type AssetStateType } from "@tagit/contracts";

const STATE_HEX: Record<number, string> = {
  0: "#6b7280",
  1: "#6b7280",
  2: "#3b82f6",
  3: "#22c55e",
  4: "#a855f7",
  5: "#ef4444",
  6: "#f97316",
};

interface HistoryEntry {
  from: number;
  to: number;
  actor: `0x${string}`;
  blockNumber: bigint;
  timestamp: number; // unix seconds (0 if unavailable)
  txHash: `0x${string}`;
}

function useAssetHistory(tokenId: bigint | undefined) {
  const chainId = useChainId();
  const contracts = getContractsForChain(chainId);
  const publicClient = usePublicClient({ chainId });
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!publicClient || tokenId === undefined) return;
    setIsLoading(true);
    (async () => {
      try {
        const latest = await publicClient.getBlockNumber();
        const span = 100_000n;
        const fromBlock = latest > span ? latest - span : 0n;
        const logs = await publicClient.getLogs({
          address: contracts.TAGITCore,
          event: {
            type: "event",
            name: "StateChanged",
            inputs: [
              { indexed: true, name: "tokenId", type: "uint256" },
              { indexed: false, name: "from", type: "uint8" },
              { indexed: false, name: "to", type: "uint8" },
              { indexed: false, name: "actor", type: "address" },
            ],
          },
          args: { tokenId },
          fromBlock,
          toBlock: "latest",
        });

        // Resolve block timestamps (few transitions per asset → cheap).
        const uniqueBlocks = [...new Set(logs.map((l) => l.blockNumber))];
        const tsByBlock = new Map<bigint, number>();
        await Promise.all(
          uniqueBlocks.map(async (bn) => {
            try {
              const blk = await publicClient.getBlock({ blockNumber: bn });
              tsByBlock.set(bn, Number(blk.timestamp));
            } catch {
              tsByBlock.set(bn, 0);
            }
          }),
        );

        const mapped: HistoryEntry[] = logs.map((l) => {
          const a = (l as unknown as { args: { from: number; to: number; actor: `0x${string}` } })
            .args;
          return {
            from: Number(a.from),
            to: Number(a.to),
            actor: a.actor,
            blockNumber: l.blockNumber ?? 0n,
            timestamp: tsByBlock.get(l.blockNumber ?? 0n) ?? 0,
            txHash: l.transactionHash ?? ("0x" as `0x${string}`),
          };
        });
        // Reverse-chronological (newest first).
        mapped.sort((x, y) => Number(y.blockNumber - x.blockNumber));
        if (!cancelled) setEntries(mapped);
      } catch {
        if (!cancelled) setEntries([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [publicClient, contracts.TAGITCore, tokenId]);

  return { entries, isLoading };
}

function relativeTime(ts: number): string {
  if (!ts) return "—";
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function short(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function LifecycleAuditTrail({
  tokenId,
  explorerBase,
}: {
  tokenId: bigint | undefined;
  /** e.g. https://sepolia.basescan.org */
  explorerBase?: string;
}) {
  const { entries, isLoading } = useAssetHistory(tokenId);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
      <div className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-gray-400">
        Audit trail
      </div>
      {isLoading && entries.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Loading on-chain history…</p>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <History className="h-7 w-7 text-gray-600" />
          <p className="text-sm text-muted-foreground">No transitions recorded yet.</p>
          <p className="text-xs text-gray-600">
            Lifecycle actions will appear here as they happen.
          </p>
        </div>
      ) : (
        <ol className="space-y-0">
          {entries.map((e, i) => {
            const hex = STATE_HEX[e.to] ?? "#6b7280";
            return (
              <li key={`${e.txHash}-${i}`} className="flex gap-3">
                {/* rail */}
                <div className="flex flex-col items-center">
                  <span
                    className="mt-1 h-3 w-3 shrink-0 rounded-full"
                    style={{ background: hex, boxShadow: `0 0 8px ${hex}88` }}
                  />
                  {i < entries.length - 1 && <span className="w-px flex-1 bg-white/10" />}
                </div>
                {/* entry */}
                <div className="flex-1 pb-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[15px] font-semibold" style={{ color: hex }}>
                      {AssetStateNames[e.from as AssetStateType]} →{" "}
                      {AssetStateNames[e.to as AssetStateType]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {relativeTime(e.timestamp)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[13px] text-muted-foreground">
                    <span className="font-mono">{short(e.actor)}</span>
                    {explorerBase && e.txHash && (
                      <a
                        href={`${explorerBase}/tx/${e.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-primary/80 hover:underline"
                      >
                        {short(e.txHash)}
                      </a>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
