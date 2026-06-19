"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, cn } from "@tagit/ui";
import { CheckCircle2, Globe, Leaf, Radiation, ShieldAlert, Siren } from "lucide-react";
import {
  COUNTRIES,
  GRADE_RANK,
  carbonFootprint,
  gradeAudit,
  originAudit,
  recallAudit,
  sanctionedAudit,
  type ProvNode,
} from "@/lib/provenance";

type QueryKey = "origin" | "recall" | "carbon" | "sanctioned" | "grade";

const QUERIES: { key: QueryKey; label: string; icon: typeof Globe }[] = [
  { key: "origin", label: "Country of origin", icon: Globe },
  { key: "recall", label: "Recall / FLAGGED", icon: Siren },
  { key: "sanctioned", label: "Sanctioned supplier", icon: ShieldAlert },
  { key: "grade", label: "Grade compliance", icon: Radiation },
  { key: "carbon", label: "Carbon footprint", icon: Leaf },
];

interface Result {
  ok: boolean; // true = clean / pass
  headline: string;
  detail: React.ReactNode;
  ids: Set<string>;
}

function runQuery(key: QueryKey, root: ProvNode): Result {
  switch (key) {
    case "origin": {
      const { nonUS, unknown, byCountry } = originAudit(root);
      // For DEFENSE-grade and above, "unverified" cannot count as clean.
      const isCritical = GRADE_RANK[root.grade] >= GRADE_RANK.DEFENSE;
      const unverifiedBlocks = isCritical && unknown.length > 0;
      const ok = nonUS.length === 0 && !unverifiedBlocks;
      const parts: string[] = [];
      if (nonUS.length > 0)
        parts.push(`${nonUS.length} non-U.S. component${nonUS.length > 1 ? "s" : ""}`);
      if (unknown.length > 0) parts.push(`${unknown.length} with unverified origin`);
      const headline =
        parts.length === 0
          ? "All components are verified U.S.-origin."
          : unverifiedBlocks && nonUS.length === 0
            ? `${unknown.length} component${unknown.length > 1 ? "s" : ""} have unverified origin — not permitted at ${root.grade} grade.`
            : `${parts.join(" · ")}.`;
      const flagged = isCritical ? [...nonUS, ...unknown] : nonUS;
      return {
        ok,
        headline,
        detail: (
          <div className="flex flex-wrap gap-2">
            {byCountry.map(({ code, count }) => {
              const c = COUNTRIES[code] ?? COUNTRIES["—"];
              const isUnknown = code === "—";
              return (
                <span
                  key={code}
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-medium",
                    code === "US"
                      ? "bg-secondary text-muted-foreground"
                      : "bg-amber-500/10 text-amber-700",
                  )}
                >
                  {c.flag} {isUnknown ? "Unverified origin" : c.name} · {count}
                </span>
              );
            })}
          </div>
        ),
        ids: new Set(flagged.map((n) => n.id)),
      };
    }
    case "recall": {
      const hits = recallAudit(root);
      return {
        ok: hits.length === 0,
        headline:
          hits.length === 0
            ? "No recalled or FLAGGED components in this tree."
            : `${hits.length} component${hits.length > 1 ? "s" : ""} under recall / FLAGGED.`,
        detail:
          hits.length > 0 ? (
            <ul className="space-y-1">
              {hits.map((n) => (
                <li key={n.id} className="text-xs text-red-600">
                  {n.label}
                  {n.batch ? ` — lot ${n.batch}` : ""}
                </li>
              ))}
            </ul>
          ) : null,
        ids: new Set(hits.map((n) => n.id)),
      };
    }
    case "sanctioned": {
      const hits = sanctionedAudit(root);
      return {
        ok: hits.length === 0,
        headline:
          hits.length === 0
            ? "No components from sanctioned suppliers."
            : `${hits.length} component${hits.length > 1 ? "s" : ""} from a sanctioned supplier.`,
        detail:
          hits.length > 0 ? (
            <ul className="space-y-1">
              {hits.map((n) => (
                <li key={n.id} className="text-xs text-red-600">
                  {n.label} — {n.supplier}
                </li>
              ))}
            </ul>
          ) : null,
        ids: new Set(hits.map((n) => n.id)),
      };
    }
    case "grade": {
      const { required, violations } = gradeAudit(root);
      return {
        ok: violations.length === 0,
        headline:
          violations.length === 0
            ? `All components meet ${required}-grade requirement.`
            : `${violations.length} component${violations.length > 1 ? "s" : ""} below ${required} grade.`,
        detail:
          violations.length > 0 ? (
            <ul className="space-y-1">
              {violations.map((n) => (
                <li key={n.id} className="text-xs text-red-600">
                  {n.label} — {n.grade} (requires {required})
                </li>
              ))}
            </ul>
          ) : null,
        ids: new Set(violations.map((n) => n.id)),
      };
    }
    case "carbon": {
      const total = carbonFootprint(root);
      return {
        ok: true,
        headline: `${total.toLocaleString()} kg CO₂ across the full provenance tree.`,
        detail: (
          <p className="text-xs text-muted-foreground">
            Summed from transport + embodied carbon of every component custody chain.
          </p>
        ),
        ids: new Set(),
      };
    }
  }
}

export function CompliancePanel({
  root,
  onHighlight,
}: {
  root: ProvNode;
  onHighlight: (ids: Set<string>) => void;
}) {
  const [active, setActive] = useState<QueryKey | null>(null);

  const result = useMemo(() => (active ? runQuery(active, root) : null), [active, root]);

  // Reset when the selected product changes.
  useEffect(() => {
    setActive(null);
    onHighlight(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root.id]);

  useEffect(() => {
    onHighlight(result?.ids ?? new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const isSample = root.id.startsWith("demo:");

  return (
    <div className="space-y-3">
      {isSample && (
        <div className="rounded-lg border border-dashed bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
          Sample data — illustrative fixtures, not on-chain facts.
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {QUERIES.map(({ key, label, icon: Icon }) => (
          <Button
            key={key}
            size="sm"
            variant={active === key ? "default" : "outline"}
            onClick={() => setActive((a) => (a === key ? null : key))}
          >
            <Icon className="mr-1.5 h-3.5 w-3.5" />
            {label}
          </Button>
        ))}
      </div>

      {result && (
        <div
          className={cn(
            "rounded-lg border p-4",
            result.ok ? "border-green-500/30 bg-green-500/5" : "border-amber-500/40 bg-amber-500/5",
          )}
        >
          <div className="flex items-start gap-2">
            {result.ok ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
            ) : (
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            )}
            <div className="space-y-2">
              <p className="text-sm font-medium">{result.headline}</p>
              {result.detail}
            </div>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Computed in one pass from the provenance tree.{" "}
            {isSample
              ? "Sample fixtures shown for illustration."
              : "On real assets these become cryptographically backed once on-chain composition ships."}
          </p>
        </div>
      )}
    </div>
  );
}
