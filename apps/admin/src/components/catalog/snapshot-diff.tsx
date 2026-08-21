"use client";

/**
 * Unified line diff between two snapshot JSON values — buildJsonDiff (pure
 * LCS, no deps) with +/- coloring. Snapshot text is user data: rendered as
 * text nodes only (REQ-S-11).
 */

import { useMemo } from "react";

import { buildJsonDiff, diffHasChanges } from "@/lib/catalog/template-logic";

interface SnapshotDiffProps {
  older: unknown;
  newer: unknown;
  olderLabel: string;
  newerLabel: string;
}

export function SnapshotDiff({ older, newer, olderLabel, newerLabel }: SnapshotDiffProps) {
  const diff = useMemo(() => buildJsonDiff(older, newer), [older, newer]);

  if (!diffHasChanges(diff)) {
    return (
      <p className="text-xs text-muted-foreground px-1">
        {olderLabel} and {newerLabel} are identical.
      </p>
    );
  }

  return (
    <div className="rounded-md border overflow-hidden">
      <div className="flex justify-between border-b bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
        <span className="text-red-500">− {olderLabel}</span>
        <span className="text-green-500">+ {newerLabel}</span>
      </div>
      <pre className="max-h-72 overflow-auto text-xs leading-5 font-mono p-0 m-0">
        {diff.map((line, i) => {
          if (line.type === "same") {
            return (
              <div key={i} className="px-3 text-muted-foreground">
                {"  "}
                {line.left}
              </div>
            );
          }
          if (line.type === "del") {
            return (
              <div key={i} className="px-3 bg-red-500/10 text-red-500">
                {"- "}
                {line.left}
              </div>
            );
          }
          return (
            <div key={i} className="px-3 bg-green-500/10 text-green-500">
              {"+ "}
              {line.right}
            </div>
          );
        })}
      </pre>
    </div>
  );
}
