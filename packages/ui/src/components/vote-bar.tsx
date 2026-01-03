"use client";

import { cn } from "../lib/utils";

export interface VoteBarProps {
  forVotes: number;
  againstVotes: number;
  abstainVotes: number;
  quorum?: number;
  showLabels?: boolean;
  showQuorum?: boolean;
  className?: string;
}

export function VoteBar({
  forVotes,
  againstVotes,
  abstainVotes,
  quorum,
  showLabels = true,
  showQuorum = true,
  className,
}: VoteBarProps) {
  const total = forVotes + againstVotes + abstainVotes;
  const forPercent = total > 0 ? (forVotes / total) * 100 : 0;
  const againstPercent = total > 0 ? (againstVotes / total) * 100 : 0;
  const abstainPercent = total > 0 ? (abstainVotes / total) * 100 : 0;
  const quorumPercent = quorum && total > 0 ? (quorum / total) * 100 : 0;

  return (
    <div className={cn("space-y-2", className)}>
      {/* Vote bar */}
      <div className="relative h-4 rounded-full overflow-hidden bg-muted">
        {/* For votes (green) */}
        <div
          className="absolute left-0 top-0 h-full bg-green-500 transition-all duration-300"
          style={{ width: `${forPercent}%` }}
        />
        {/* Against votes (red) */}
        <div
          className="absolute top-0 h-full bg-red-500 transition-all duration-300"
          style={{ left: `${forPercent}%`, width: `${againstPercent}%` }}
        />
        {/* Abstain votes (gray) */}
        <div
          className="absolute top-0 h-full bg-gray-400 transition-all duration-300"
          style={{
            left: `${forPercent + againstPercent}%`,
            width: `${abstainPercent}%`,
          }}
        />
        {/* Quorum indicator */}
        {showQuorum && quorum !== undefined && quorumPercent > 0 && (
          <div
            className="absolute top-0 h-full w-0.5 bg-foreground/50"
            style={{ left: `${Math.min(quorumPercent, 100)}%` }}
            title={`Quorum: ${quorum.toLocaleString()}`}
          />
        )}
      </div>

      {/* Labels */}
      {showLabels && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span>For {forPercent.toFixed(1)}%</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span>Against {againstPercent.toFixed(1)}%</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-gray-400" />
            <span>Abstain {abstainPercent.toFixed(1)}%</span>
          </div>
        </div>
      )}

      {/* Vote counts */}
      <div className="flex justify-between text-sm">
        <span className="text-green-600 font-medium">
          {forVotes.toLocaleString()}
        </span>
        <span className="text-red-600 font-medium">
          {againstVotes.toLocaleString()}
        </span>
        <span className="text-gray-600 font-medium">
          {abstainVotes.toLocaleString()}
        </span>
      </div>

      {/* Quorum status */}
      {showQuorum && quorum !== undefined && (
        <div className="text-xs text-muted-foreground">
          Quorum: {total.toLocaleString()} / {quorum.toLocaleString()} (
          {((total / quorum) * 100).toFixed(1)}%)
          {total >= quorum && (
            <span className="ml-1 text-green-600">✓ Reached</span>
          )}
        </div>
      )}
    </div>
  );
}
