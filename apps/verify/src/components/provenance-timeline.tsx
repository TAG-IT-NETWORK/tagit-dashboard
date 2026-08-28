/**
 * Provenance timeline for /asset/[tokenId] (META-T37) — the on-chain lifecycle
 * event history, rendered below the fold inside a <Suspense> boundary.
 *
 * WHY SUSPENSE. The verdict band and identity card are the page's reason to
 * exist and they render from data the page already fetched — they must hit the
 * first flush. The timeline is an eth_getLogs history scan (@/lib/lifecycle),
 * which on anything but an archive-range provider is slow or refused outright.
 * Suspending it lets the shell stream first on a cache MISS while the scan
 * resolves; on the 60s ISR cache HIT the whole page — timeline included — is
 * served as stored HTML.
 *
 * HONESTY RULES (inherited from @/lib/lifecycle, do not soften them):
 *   - `available: false` renders an explicit "could not be read" note, never
 *     an empty timeline — "we could not look" and "there is no history" are
 *     different claims.
 *   - A partial scan never reaches this component; lifecycle.ts aborts rather
 *     than returning a timeline with silent holes.
 *   - NO RAW ADDRESSES: events carry domain-separated commitments only (see
 *     addressCommitment in @/lib/verdict); this component renders none of
 *     them. Tx hashes ARE shown — they are the re-derivation handle and were
 *     never secret.
 */
import { Suspense } from "react";
import { getPublicClient } from "@/lib/contract.server";
import { getLifecycleHistory, type LifecycleEvent } from "@/lib/lifecycle";
import { parseTokenId } from "@/lib/verdict";

function eventLabel(event: LifecycleEvent): string {
  switch (event.type) {
    case "AssetMinted":
      return "Minted — digital twin created";
    case "TagBound":
      return "NFC tag bound";
    case "AssetResold":
      return "Resold";
    case "StateChanged":
      return event.from_state && event.to_state
        ? `${event.from_state} → ${event.to_state}`
        : "State changed";
  }
}

function QuietNote({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-gray-600 leading-relaxed text-center">{children}</p>;
}

function TimelineFrame({ children }: { children: React.ReactNode }) {
  return (
    <section
      className="rounded-2xl border border-white/10 p-5 mb-5"
      style={{ background: "rgba(255,255,255,0.03)" }}
      aria-label="Provenance timeline"
    >
      <h2 className="text-gray-500 text-xs uppercase tracking-wider mb-3">Provenance</h2>
      {children}
    </section>
  );
}

/** The async part: pins the chain head, then scans history at that height. */
async function TimelineBody({ tokenId }: { tokenId: string }) {
  const parsed = parseTokenId(tokenId);
  if (parsed === null) return null;

  let result: Awaited<ReturnType<typeof getLifecycleHistory>>;
  try {
    // Pin the head first so the scan range is a single node's view — the same
    // pin-then-read ordering the verdict builder uses (@/lib/verdict readAt).
    const head = await getPublicClient().getBlock({ blockTag: "latest" });
    if (head.number === null) throw new Error("unpinnable head");
    result = await getLifecycleHistory(parsed, head.number);
  } catch {
    return (
      <TimelineFrame>
        <QuietNote>
          The lifecycle timeline could not be read from the chain right now. This says nothing
          about the item itself — the verdict above is unaffected.
        </QuietNote>
      </TimelineFrame>
    );
  }

  if (!result.available) {
    return (
      <TimelineFrame>
        <QuietNote>
          The lifecycle timeline could not be read from the chain right now. This says nothing
          about the item itself — the verdict above is unaffected.
        </QuietNote>
      </TimelineFrame>
    );
  }

  if (result.events.length === 0) {
    return (
      <TimelineFrame>
        <QuietNote>No lifecycle events found on-chain for this token.</QuietNote>
      </TimelineFrame>
    );
  }

  return (
    <TimelineFrame>
      <ol className="space-y-0">
        {result.events.map((event, i) => (
          <li key={`${event.transaction_hash}-${event.log_index}`}>
            {i > 0 && <div className="border-t border-white/5" />}
            <div className="flex items-start gap-3 py-3">
              <span
                className="mt-1.5 w-2 h-2 rounded-full bg-[#00D68F]/60 flex-shrink-0"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-white text-sm">{eventLabel(event)}</p>
                <p className="text-gray-600 text-[11px] font-mono break-all">
                  block {event.block_number} ·{" "}
                  <a
                    href={`https://sepolia.basescan.org/tx/${event.transaction_hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {event.transaction_hash.slice(0, 10)}…{event.transaction_hash.slice(-8)}
                  </a>
                </p>
              </div>
            </div>
          </li>
        ))}
      </ol>
      <p className="text-[10px] text-gray-700 mt-2 font-mono">
        scanned blocks {result.scan.from_block}–{result.scan.to_block} via eth_getLogs
      </p>
    </TimelineFrame>
  );
}

/** Streaming skeleton — occupies the frame so the layout does not jump. */
function TimelineFallback() {
  return (
    <TimelineFrame>
      <div className="space-y-3 animate-pulse" aria-hidden="true">
        <div className="h-3 w-2/3 rounded bg-white/5" />
        <div className="h-3 w-1/2 rounded bg-white/5" />
        <div className="h-3 w-3/5 rounded bg-white/5" />
      </div>
      <p className="sr-only">Loading provenance timeline…</p>
    </TimelineFrame>
  );
}

/**
 * Public entry: the Suspense boundary lives HERE so the page cannot
 * accidentally mount TimelineBody without one and block the first flush.
 */
export function ProvenanceTimeline({ tokenId }: { tokenId: string }) {
  return (
    <Suspense fallback={<TimelineFallback />}>
      <TimelineBody tokenId={tokenId} />
    </Suspense>
  );
}
