"use client";

import { useState } from "react";
import { Badge, StateBadge, cn } from "@tagit/ui";
import { AlertTriangle, Box, ChevronDown, ChevronRight, Layers, Package } from "lucide-react";
import { COUNTRIES, type Grade, type NodeKind, type ProvNode } from "@/lib/provenance";

const GRADE_STYLE: Record<Grade, string> = {
  COMMERCIAL: "bg-secondary text-muted-foreground",
  INDUSTRIAL: "bg-blue-500/10 text-blue-600",
  SPACE: "bg-indigo-500/10 text-indigo-600",
  DEFENSE: "bg-amber-500/10 text-amber-600",
  NUCLEAR: "bg-red-500/10 text-red-600",
};

const KIND_ICON: Record<NodeKind, typeof Box> = {
  root: Package,
  subassembly: Layers,
  leaf: Box,
};

interface TreeProps {
  node: ProvNode;
  /** ids to highlight (compliance query / recall results) */
  highlight?: Set<string>;
  depth?: number;
  defaultOpen?: boolean;
}

function country(code: string) {
  return COUNTRIES[code] ?? COUNTRIES["—"];
}

function NodeRow({ node, highlight, depth = 0, defaultOpen = true }: TreeProps) {
  const [open, setOpen] = useState(defaultOpen || depth < 2);
  const hasChildren = node.children.length > 0;
  const Icon = KIND_ICON[node.kind];
  const hit = highlight?.has(node.id);
  const c = country(node.origin);

  return (
    <div>
      <div
        className={cn(
          "group flex items-start gap-2 rounded-lg px-2 py-2 transition-colors",
          hit ? "bg-amber-500/10 ring-1 ring-amber-500/40" : "hover:bg-secondary/50",
        )}
      >
        <button
          type="button"
          onClick={() => hasChildren && setOpen((o) => !o)}
          disabled={!hasChildren}
          aria-hidden={!hasChildren}
          tabIndex={hasChildren ? 0 : -1}
          aria-label={
            hasChildren ? (open ? `Collapse ${node.label}` : `Expand ${node.label}`) : undefined
          }
          aria-expanded={hasChildren ? open : undefined}
          className={cn(
            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded",
            hasChildren ? "text-muted-foreground hover:bg-secondary" : "opacity-0",
          )}
        >
          {hasChildren &&
            (open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}
        </button>

        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{node.label}</span>
            {node.flagged && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
                <AlertTriangle className="h-3.5 w-3.5" /> FLAGGED
              </span>
            )}
            {node.sanctioned && (
              <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-600">
                SANCTIONED SUPPLIER
              </span>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span title={c.name}>
              {c.flag} {node.origin === "—" ? "Unverified origin" : c.name}
            </span>
            <span className={cn("rounded px-1.5 py-0.5 font-medium", GRADE_STYLE[node.grade])}>
              {node.grade}
            </span>
            <span>{node.supplier}</span>
            {node.tokenId && <span className="font-mono">#{node.tokenId}</span>}
            {node.batch && <span className="font-mono">lot {node.batch}</span>}
            {typeof node.carbonKg === "number" && <span>{node.carbonKg} kg CO₂</span>}
          </div>

          {node.certifications.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {node.certifications.map((cert) => (
                <Badge key={cert} variant="outline" className="text-[10px]">
                  {cert}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0">
          <StateBadge state={node.state} />
        </div>
      </div>

      {hasChildren && open && (
        <div className="ml-4 border-l pl-3">
          {node.children.map((child) => (
            <NodeRow key={child.id} node={child} highlight={highlight} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ProvenanceTree({ node, highlight }: { node: ProvNode; highlight?: Set<string> }) {
  return (
    <div className="text-sm">
      <NodeRow node={node} highlight={highlight} depth={0} />
    </div>
  );
}
