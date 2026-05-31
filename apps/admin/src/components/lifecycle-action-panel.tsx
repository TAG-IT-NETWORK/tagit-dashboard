"use client";

/**
 * State-driven lifecycle action panel for the Digital Twin Console.
 *
 * Renders the actions VALID FROM the asset's current on-chain state (via the
 * FSM engine), each enabled or disabled-with-a-reason based on the connected
 * wallet's BIDGES capability / ownership. Replaces the old linear stepper where
 * only the single "next" action was ever shown.
 *
 * Presentational: emits `onAction(key)`; the parent page wires execution
 * (some actions — claim/resolve/transfer — need extra inputs collected there).
 */
import { Card, CardContent, CardHeader, CardTitle } from "@tagit/ui";
import { ArrowLeftRight, Flag, Lock, Nfc, RecycleIcon, Scale, UserCheck, Zap } from "lucide-react";
import type { ComponentType } from "react";
import { AssetStateNames, type AssetStateType } from "@tagit/contracts";
import { useLifecycleActions, type LifecycleActionKey } from "@/lib/lifecycle-fsm";

const ACTION_ICONS: Record<LifecycleActionKey, ComponentType<{ className?: string }>> = {
  bind: Nfc,
  activate: Zap,
  claim: UserCheck,
  transfer: ArrowLeftRight,
  flag: Flag,
  resolve: Scale,
  recycle: RecycleIcon,
};

// tone -> tailwind classes for the (enabled) action button
const TONE_CLASSES: Record<"primary" | "warn" | "danger", string> = {
  primary: "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20",
  warn: "border-yellow-500/40 bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20",
  danger: "border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20",
};

interface LifecycleActionPanelProps {
  state: AssetStateType;
  /** Current asset owner — gates the owner-only resale action. */
  owner?: `0x${string}`;
  /** Fired when an enabled action button is clicked. */
  onAction: (key: LifecycleActionKey) => void;
  /** Action currently mid-transaction (shows a spinner / disables the row). */
  pendingAction?: LifecycleActionKey | null;
}

export function LifecycleActionPanel({
  state,
  owner,
  onAction,
  pendingAction = null,
}: LifecycleActionPanelProps) {
  const actions = useLifecycleActions(state, owner);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Available actions</CardTitle>
        <span className="text-xs text-muted-foreground">
          state: <span className="font-medium text-foreground">{AssetStateNames[state]}</span>
        </span>
      </CardHeader>
      <CardContent className="space-y-2">
        {actions.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No further actions — this asset is in a terminal state.
          </p>
        ) : (
          actions.map((a) => {
            const Icon = ACTION_ICONS[a.key];
            const isPending = pendingAction === a.key;
            const clickable = a.enabled && !isPending;
            return (
              <div key={a.key} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                        a.enabled
                          ? TONE_CLASSES[a.tone]
                          : "border-white/10 bg-white/5 text-gray-500"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        {a.label}
                        {a.quorum && (
                          <span className="rounded bg-yellow-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-500">
                            2-of-3
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{a.description}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!clickable}
                    onClick={() => clickable && onAction(a.key)}
                    className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      clickable
                        ? TONE_CLASSES[a.tone]
                        : "cursor-not-allowed border-white/10 bg-white/5 text-gray-500"
                    }`}
                  >
                    {isPending ? (
                      "Confirm…"
                    ) : a.enabled ? (
                      a.label
                    ) : (
                      <Lock className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
                {!a.enabled && a.reason && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-yellow-500/80">
                    <Lock className="h-3 w-3 shrink-0" />
                    {a.reason}
                  </p>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
