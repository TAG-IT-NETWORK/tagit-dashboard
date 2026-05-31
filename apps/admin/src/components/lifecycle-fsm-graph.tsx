"use client";

/**
 * Branched lifecycle FSM graph for the Digital Twin Console.
 *
 * Two balanced rows that fill the card width:
 *   1. Manufacturing → consumer spine: Minted → Bound → Activated → Claimed.
 *   2. Recovery & end-of-life: Flagged (flag from Bound/Activated/Claimed;
 *      resolve restores the exact prior state) and the Recycled terminal
 *      (recycle from any live state).
 * The asset's current state glows.
 */
import { AssetState, AssetStateNames, type AssetStateType } from "@tagit/contracts";
import { RotateCcw } from "lucide-react";

// State → accent hex (matches @tagit/ui StateBadge palette).
const STATE_HEX: Record<number, string> = {
  0: "#6b7280",
  1: "#6b7280",
  2: "#3b82f6",
  3: "#22c55e",
  4: "#a855f7",
  5: "#ef4444",
  6: "#f97316",
};

function Node({
  state,
  current,
  size = "md",
}: {
  state: AssetStateType;
  current: boolean;
  size?: "md" | "sm";
}) {
  const hex = STATE_HEX[state];
  const pad = size === "md" ? "px-5 py-3 min-w-[112px]" : "px-4 py-2.5 min-w-[96px]";
  return (
    <div
      className={`relative flex flex-col items-center justify-center rounded-2xl border transition-all ${pad}`}
      style={{
        borderColor: current ? hex : `${hex}40`,
        background: current ? `${hex}24` : `${hex}0a`,
        boxShadow: current ? `0 0 0 1px ${hex}, 0 0 26px ${hex}66` : "none",
      }}
    >
      {current && (
        <span
          className="absolute -right-1.5 -top-1.5 h-3 w-3 animate-pulse rounded-full"
          style={{ background: hex, boxShadow: `0 0 8px ${hex}` }}
        />
      )}
      <span className="text-[11px] font-bold tabular-nums" style={{ color: `${hex}cc` }}>
        {state}
      </span>
      <span
        className="mt-0.5 text-sm font-bold tracking-wide"
        style={{ color: current ? "#fff" : `${hex}dd` }}
      >
        {AssetStateNames[state]}
      </span>
    </div>
  );
}

/** Horizontal arrow with a label above it. */
function Arrow({ label }: { label: string }) {
  return (
    <div className="flex min-w-[52px] flex-1 flex-col items-center gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </span>
      <div className="flex w-full items-center text-gray-500">
        <div className="h-px flex-1 bg-white/25" />
        <span className="-ml-[3px] text-[10px] leading-none">▶</span>
      </div>
    </div>
  );
}

export function LifecycleFsmGraph({ state }: { state: AssetStateType }) {
  const isFlagged = state === AssetState.FLAGGED;
  const isRecycled = state === AssetState.RECYCLED;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
      <div className="mb-5 text-xs font-semibold uppercase tracking-[0.15em] text-gray-400">
        Lifecycle · live position
      </div>

      {/* Spine: Minted → Bound → Activated → Claimed */}
      <div className="flex items-center">
        <Node state={AssetState.MINTED} current={state === AssetState.MINTED} />
        <Arrow label="bind" />
        <Node state={AssetState.BOUND} current={state === AssetState.BOUND} />
        <Arrow label="activate" />
        <Node state={AssetState.ACTIVATED} current={state === AssetState.ACTIVATED} />
        <Arrow label="claim" />
        <Node state={AssetState.CLAIMED} current={state === AssetState.CLAIMED} />
      </div>

      {/* Recovery & end-of-life */}
      <div className="mt-6 rounded-xl border border-white/[0.07] bg-white/[0.015] p-4">
        <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.15em] text-gray-400">
          Recovery &amp; end-of-life
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-xs font-medium uppercase tracking-wider text-red-400/80">
            flag&nbsp;▶
          </span>
          <Node state={AssetState.FLAGGED} current={isFlagged} size="sm" />
          <div className="flex items-center gap-1.5 text-xs text-yellow-500/90">
            <RotateCcw className="h-3.5 w-3.5" />
            <span>resolve restores prior state</span>
          </div>
          <span className="text-gray-600">·</span>
          <span className="text-xs font-medium uppercase tracking-wider text-orange-400/80">
            recycle&nbsp;▶
          </span>
          <Node state={AssetState.RECYCLED} current={isRecycled} size="sm" />
        </div>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-gray-400">
        <span className="text-gray-300">Flag</span> is valid from Bound, Activated, or Claimed
        (recall / theft / lost-stolen). <span className="text-gray-300">Resolve</span> restores the
        exact pre-flag state — never a forward skip. <span className="text-gray-300">Recycle</span>{" "}
        (scrap / void / end-of-life) works from any live state.
      </p>
    </div>
  );
}
