"use client";

import { TRUST_TIERS, type TierKey } from "@/lib/mesh";
import { cn } from "@tagit/ui";
import { Check, Lock } from "lucide-react";

/** Vertical trust-tier ladder (§5.2) with the agent's current tier highlighted. */
export function TrustTierLadder({ current }: { current: TierKey }) {
  const currentIdx = TRUST_TIERS.findIndex((t) => t.key === current);

  return (
    <div className="space-y-1.5">
      {TRUST_TIERS.map((tier, i) => {
        const reached = i <= currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <div
            key={tier.key}
            className={cn(
              "flex items-start gap-3 rounded-lg border px-3 py-2.5",
              isCurrent && "border-primary bg-secondary/50 ring-1 ring-primary",
              !reached && "opacity-55",
            )}
          >
            <div
              className={cn(
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                reached
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground",
              )}
            >
              {reached ? <Check className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  {tier.name}
                  {isCurrent && (
                    <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                      CURRENT
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">max {tier.maxDeal}</span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{tier.access}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Requires score ≥ {tier.minScore.toLocaleString()} · {tier.minDeals}+ deals
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
