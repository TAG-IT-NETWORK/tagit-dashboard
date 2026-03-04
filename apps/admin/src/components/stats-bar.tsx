"use client";

import { useMemo } from "react";
import { type StateDistribution } from "@tagit/contracts";
import { Card, CardHeader, CardTitle, CardContent } from "@tagit/ui";
import { BarChart3 } from "lucide-react";

const stateColors: Record<number, string> = {
  0: "#6b7280",
  1: "#3b82f6",
  2: "#22c55e",
  3: "#a855f7",
  4: "#ef4444",
  5: "#f97316",
};

interface StatsBarProps {
  distribution: StateDistribution[] | null;
  loading?: boolean;
}

export function StatsBar({ distribution, loading }: StatsBarProps) {
  const { total, segments } = useMemo(() => {
    if (!distribution) {
      return { total: 0, segments: [] };
    }
    const t = distribution.reduce((sum, s) => sum + s.value, 0);
    const segs = distribution.map((s) => ({
      ...s,
      percent: t > 0 ? (s.value / t) * 100 : 0,
    }));
    return { total: t, segments: segs };
  }, [distribution]);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Lifecycle Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-8 w-full animate-pulse bg-muted rounded-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Lifecycle Distribution
          </CardTitle>
          <span className="text-sm text-muted-foreground">{total} total</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Stacked Bar */}
        <div className="flex h-8 rounded-full overflow-hidden bg-muted">
          {segments.map((seg) =>
            seg.percent > 0 ? (
              <div
                key={seg.state}
                className="h-full transition-all duration-500 flex items-center justify-center text-[10px] font-bold text-white"
                style={{
                  width: `${Math.max(seg.percent, 2)}%`,
                  backgroundColor: stateColors[seg.state],
                }}
                title={`${seg.name}: ${seg.value} (${seg.percent.toFixed(1)}%)`}
              >
                {seg.percent >= 8 ? seg.value : ""}
              </div>
            ) : null
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {segments.map((seg) => (
            <div key={seg.state} className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: stateColors[seg.state] }}
              />
              <span className="text-xs text-muted-foreground">
                {seg.name}: {seg.value} ({seg.percent.toFixed(0)}%)
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
