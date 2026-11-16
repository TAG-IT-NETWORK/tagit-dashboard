"use client";

/**
 * Product history for the shopper pages — the item's recorded life, in plain
 * words, loaded CLIENT-SIDE after mount (META-T37 / DASH-T37-SUSPENSE-ISR,
 * reworded for TAP-T08).
 *
 * WHY CLIENT-SIDE AND NOT SUSPENSE. /asset/[tokenId] is SSG/ISR, and a static
 * render resolves every Suspense boundary to completion before the HTML is
 * stored, so on a cache MISS the whole page would block on the history scan.
 * The static page carries only the skeleton below; after hydration this
 * component fetches GET /api/asset/[tokenId]/provenance, which runs the scan
 * server-side and returns the projection in @/lib/provenance-wire.
 *
 * HONESTY RULES (inherited from @/lib/lifecycle, do not soften them):
 *   - an unavailable scan renders an explicit "couldn't load" note, never an
 *     empty history — "we could not look" and "there is no history" are
 *     different claims. A failed fetch, a non-200 and `available: false` all
 *     land on that note.
 *   - A partial scan never reaches this component; lifecycle.ts aborts rather
 *     than returning a history with silent holes.
 *
 * WHAT IS SHOWN. Steps only: made, tag attached, released for sale, bought and
 * so on, in order. Block numbers, transaction hashes and state names are not
 * shown here; the public record behind "Technical details" has them all. The
 * wire carries no dates, so none are shown (showing one for some steps and
 * not others would read as if the others had no date).
 */
import { useEffect, useState } from "react";

import { COPY } from "@/lib/consumer-copy";
import type { ProvenanceWire, ProvenanceWireEvent } from "@/lib/provenance-wire";
import type { HistoryStatus } from "@/lib/tap-view";

/** One wire event in the shopper's words, or null when it adds nothing. */
export function historyLabel(event: ProvenanceWireEvent, brand?: string): string | null {
  switch (event.type) {
    case "AssetMinted":
      return brand ? COPY.history.madeBy(brand) : COPY.history.made;
    case "TagBound":
      return COPY.history.tagAttached;
    case "AssetResold":
      return COPY.history.resold;
    case "StateChanged":
      // Closing a report puts the item back exactly where it was before, which
      // can be any step — so this comes first, or the closing would read as a
      // second "released" or "bought", or be dropped with the steps below.
      if (event.from_state === "FLAGGED" && event.to_state !== "RECYCLED") {
        return COPY.history.reportClosed;
      }
      switch (event.to_state) {
        // Minting and binding have their own events; the state change that
        // comes with each would only repeat the line.
        case "MINTED":
        case "BOUND":
          return null;
        case "ACTIVATED":
          return COPY.history.released;
        case "CLAIMED":
          return COPY.history.bought;
        case "FLAGGED":
          return COPY.history.reported;
        case "RECYCLED":
          return COPY.history.retired;
        default:
          return COPY.history.updated;
      }
  }
}

/** The state an event leaves the item in, as the wire names it. */
function reachedBy(event: ProvenanceWireEvent): string | undefined {
  switch (event.type) {
    case "AssetMinted":
      return "MINTED";
    case "TagBound":
      return "BOUND";
    case "AssetResold":
      return "CLAIMED";
    case "StateChanged":
      return event.to_state;
  }
}

/** An item's ordinary life, in order: made, tag attached, released, bought. */
const MAIN_LINE = ["MINTED", "BOUND", "ACTIVATED", "CLAIMED"];
const MAIN_LINE_STEP: Record<string, string> = {
  BOUND: COPY.history.tagAttached,
  ACTIVATED: COPY.history.released,
  CLAIMED: COPY.history.bought,
};

/**
 * The steps to show, in order, without a step repeating itself back to back.
 *
 * `status` is where the item stands NOW, as the page itself just read it. The
 * recorded history can stop short of that: the list of events may not hold the
 * latest step yet. When it does, the missing steps are added, so the history
 * never ends earlier than the status shown at the top of the same page (an
 * item marked "Owned" whose history stops at "Released for sale").
 *
 * Only steps that MUST have happened are added, and only forwards:
 *   - an item that is released or owned has passed every step before that;
 *   - a reported or retired item got its report or retirement last.
 * Nothing is added to an empty history, nothing is ever removed, and a status
 * that is behind the history (a page a moment out of date) changes nothing.
 */
export function historySteps(
  events: ProvenanceWireEvent[],
  brand?: string,
  status?: HistoryStatus,
): string[] {
  const steps: string[] = [];
  const add = (label: string | null | undefined) => {
    if (label && steps[steps.length - 1] !== label) steps.push(label);
  };

  let last: string | undefined;
  for (const event of events) {
    add(historyLabel(event, brand));
    last = reachedBy(event) ?? last;
  }
  if (steps.length === 0 || !status) return steps;

  if (status === "released" || status === "owned") {
    const from = last ? MAIN_LINE.indexOf(last) : -1;
    const to = MAIN_LINE.indexOf(status === "owned" ? "CLAIMED" : "ACTIVATED");
    if (from >= 0) for (let i = from + 1; i <= to; i++) add(MAIN_LINE_STEP[MAIN_LINE[i]!]);
  } else if (status === "reported" && last !== "FLAGGED") {
    add(COPY.history.reported);
  } else if (status === "retired" && last !== "RECYCLED") {
    add(COPY.history.retired);
  }
  return steps;
}

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-line p-4">{children}</div>;
}

function QuietNote({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-5 text-muted">{children}</p>;
}

/** Pre-fetch skeleton — occupies the frame so the layout does not jump. This
 *  is also what the stored static HTML contains. */
function Skeleton() {
  return (
    <Frame>
      <div className="flex flex-col gap-4" aria-hidden="true">
        <div className="h-3.5 w-2/3 rounded bg-surface" />
        <div className="h-3.5 w-1/2 rounded bg-surface" />
        <div className="h-3.5 w-3/5 rounded bg-surface" />
      </div>
      <p className="sr-only">{COPY.history.loading}</p>
    </Frame>
  );
}

type TimelineState =
  | { phase: "loading" }
  | { phase: "unavailable" }
  | { phase: "ready"; wire: Extract<ProvenanceWire, { available: true }> };

export function ProvenanceTimeline({
  tokenId,
  brand,
  status,
}: {
  tokenId: string;
  brand?: string;
  /** Where the item stands now, as the page read it (see historySteps). */
  status?: HistoryStatus;
}) {
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

  if (state.phase === "loading") return <Skeleton />;

  if (state.phase === "unavailable") {
    return (
      <Frame>
        <QuietNote>{COPY.history.unavailable}</QuietNote>
      </Frame>
    );
  }

  const steps = historySteps(state.wire.events, brand, status);

  if (steps.length === 0) {
    return (
      <Frame>
        <QuietNote>{COPY.history.empty}</QuietNote>
      </Frame>
    );
  }

  return (
    <Frame>
      <ol className="flex list-none flex-col gap-4">
        {steps.map((step, i) => (
          <li key={`${i}-${step}`} className="flex items-start gap-3">
            <span className="mt-1.5 h-2.5 w-2.5 flex-none rounded-full bg-ink" aria-hidden="true" />
            <p className="text-[15px] font-semibold leading-[22px]">{step}</p>
          </li>
        ))}
      </ol>
    </Frame>
  );
}
