"use client";

/**
 * Branched lifecycle FSM graph for the Digital Twin Console.
 *
 * Shows the REAL state-machine topology (not the old straight line): the
 * manufacturing spine (Minted → Bound → Activated → Claimed), the recall branch
 * down to Flagged (flag from Bound/Activated/Claimed; resolve restores the exact
 * prior state), and the Recycled terminal (reachable from any live state). The
 * asset's current state glows; visited/relevant states are emphasized.
 */
import { AssetState, AssetStateNames, type AssetStateType } from "@tagit/contracts";

// State -> accent hex (matches @tagit/ui StateBadge palette).
const STATE_HEX: Record<number, string> = {
  0: "#6b7280",
  1: "#6b7280",
  2: "#3b82f6",
  3: "#22c55e",
  4: "#a855f7",
  5: "#ef4444",
  6: "#f97316",
};

function Node({ state, current }: { state: AssetStateType; current: boolean }) {
  const hex = STATE_HEX[state];
  return (
    <div
      className="relative flex flex-col items-center gap-1 rounded-xl border px-3 py-2 transition-all"
      style={{
        borderColor: current ? hex : `${hex}40`,
        background: current ? `${hex}26` : `${hex}0d`,
        boxShadow: current ? `0 0 0 1px ${hex}, 0 0 18px ${hex}55` : "none",
      }}
    >
      {current && (
        <span
          className="absolute -top-1.5 -right-1.5 h-3 w-3 animate-pulse rounded-full"
          style={{ background: hex }}
        />
      )}
      <span className="text-[10px] font-semibold tabular-nums" style={{ color: `${hex}cc` }}>
        {state}
      </span>
      <span
        className="text-xs font-bold tracking-wide"
        style={{ color: current ? "#fff" : `${hex}cc` }}
      >
        {AssetStateNames[state]}
      </span>
    </div>
  );
}

function Edge({ label, vertical = false }: { label: string; vertical?: boolean }) {
  if (vertical) {
    return (
      <div className="flex flex-col items-center text-gray-600">
        <div className="h-5 w-px bg-white/15" />
        <span className="my-0.5 text-[9px] uppercase tracking-wider text-gray-500">{label}</span>
        <div className="h-5 w-px bg-white/15" />
      </div>
    );
  }
  return (
    <div className="flex flex-1 flex-col items-center">
      <span className="mb-0.5 text-[9px] uppercase tracking-wider text-gray-500">{label}</span>
      <div className="h-px w-full bg-white/15" />
    </div>
  );
}

export function LifecycleFsmGraph({ state }: { state: AssetStateType }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="mb-4 text-xs font-medium uppercase tracking-wider text-gray-500">
        Lifecycle — live position
      </div>

      {/* Manufacturing spine */}
      <div className="flex items-center gap-1">
        <Node state={AssetState.MINTED} current={state === AssetState.MINTED} />
        <Edge label="bind" />
        <Node state={AssetState.BOUND} current={state === AssetState.BOUND} />
        <Edge label="activate" />
        <Node state={AssetState.ACTIVATED} current={state === AssetState.ACTIVATED} />
        <Edge label="claim" />
        <Node state={AssetState.CLAIMED} current={state === AssetState.CLAIMED} />
      </div>

      {/* Recall branch: flag down from the spine, resolve back up */}
      <div className="mt-1 flex items-start justify-end gap-6 pr-2">
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2 text-[9px] uppercase tracking-wider text-gray-500">
            <span className="text-red-400/70">↓ flag</span>
            <span className="text-yellow-500/70">resolve ↑</span>
          </div>
          <div className="my-1 h-4 w-px bg-white/15" />
          <Node state={AssetState.FLAGGED} current={state === AssetState.FLAGGED} />
          <Edge label="recycle" vertical />
          <Node state={AssetState.RECYCLED} current={state === AssetState.RECYCLED} />
        </div>
      </div>

      <p className="mt-3 text-[10px] leading-relaxed text-gray-600">
        Flag is valid from Bound, Activated, or Claimed (recall / theft). Resolve restores the exact
        pre-flag state. Recycle (scrap / void / end-of-life) is valid from any live state.
      </p>
    </div>
  );
}
