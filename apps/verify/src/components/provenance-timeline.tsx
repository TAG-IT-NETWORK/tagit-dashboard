"use client";

/**
 * Provenance timeline for /asset/[tokenId] (META-T37, reworked for
 * DASH-T37-SUSPENSE-ISR) — the on-chain lifecycle event history, rendered
 * below the fold and loaded CLIENT-SIDE after mount.
 *
 * WHY CLIENT-SIDE AND NOT SUSPENSE. The first cut of this component was an
 * async server component inside a <Suspense> boundary, on the theory that the
 * eth_getLogs scan would stream in behind the first flush. That theory is
 * wrong for THIS route: /asset/[tokenId] is SSG/ISR, and Next 14 does not
 * stream static renders — a static/ISR render resolves every Suspense
 * boundary to completion before the HTML is stored, so on a cache MISS the
 * whole page blocked on the chain scan and the 'first-paint fast' intent
 * failed exactly on cold pages. Now the static page carries only the skeleton
 * (the pre-fetch state below); after hydration this component fetches
 * GET /api/asset/[tokenId]/provenance, which runs the same
 * @/lib/lifecycle scan server-side and returns the projection in
 * @/lib/provenance-wire. The static page contains zero timeline blocking
 * work.
 *
 * HONESTY RULES (inherited from @/lib/lifecycle, do not soften them):
 *   - an unavailable scan renders an explicit "could not be read" note, never
 *     an empty timeline — "we could not look" and "there is no history" are
 *     different claims. A failed fetch, a non-200 and `available: false` all
 *     land on that note.
 *   - A partial scan never reaches this component; lifecycle.ts aborts rather
 *     than returning a timeline with silent holes.
 *   - NO RAW ADDRESSES: the wire shape carries only what these rows render —
 *     event labels, block numbers and tx hashes. Tx hashes ARE shown — they
 *     are the re-derivation handle and were never secret.
 */
import { useEffect, useState } from "react";
import type { ProvenanceWire, ProvenanceWireEvent } from "@/lib/provenance-wire";

function eventLabel(event: ProvenanceWireEvent): string {
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

/** Pre-fetch skeleton — occupies the frame so the layout does not jump. This
 *  is also what the stored static HTML contains. */
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

type TimelineState =
  | { phase: "loading" }
  | { phase: "unavailable" }
  | { phase: "ready"; wire: Extract<ProvenanceWire, { available: true }> };

export function ProvenanceTimeline({ tokenId }: { tokenId: string }) {
  const [state, setState] = useState<TimelineState>({ phase: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(`/api/asset/${tokenId}/provenance`, {
          headers: { accept: "application/json" },
          signal: controller.signal,
        });
        if (!res.ok) {
          setState({ phase: "unavailable" });
          return;
        }
        const wire = (await res.json()) as ProvenanceWire;
        setState(
          wire && wire.available === true && Array.isArray(wire.events)
            ? { phase: "ready", wire }
            : { phase: "unavailable" },
        );
      } catch {
        // An abort means we unmounted — set no state. Anything else is a
        // genuine could-not-look.
        if (!controller.signal.aborted) setState({ phase: "unavailable" });
      }
    })();
    return () => controller.abort();
  }, [tokenId]);

  if (state.phase === "loading") return <TimelineFallback />;

  if (state.phase === "unavailable") {
    return (
      <TimelineFrame>
        <QuietNote>
          The lifecycle timeline could not be read from the chain right now. This says nothing
          about the item itself — the verdict above is unaffected.
        </QuietNote>
      </TimelineFrame>
    );
  }

  const { events, scan } = state.wire;

  if (events.length === 0) {
    return (
      <TimelineFrame>
        <QuietNote>No lifecycle events found on-chain for this token.</QuietNote>
      </TimelineFrame>
    );
  }

  return (
    <TimelineFrame>
      <ol className="space-y-0">
        {events.map((event, i) => (
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
        scanned blocks {scan.from_block}–{scan.to_block} via eth_getLogs
      </p>
    </TimelineFrame>
  );
}
