"use client";

import type { ReputationSummary } from "@/lib/agents";

/*
 * Agent Mesh + Trust Economy model (whitepaper §3, §5).
 *
 * On-chain we have ERC-8004 identity + a composite reputation summary per agent.
 * The trust-tier ladder (§5.2) and the 6 scoring dimensions (§5.3) are derived
 * from that composite here; per-dimension scoring and tier gating ship in Phase 3.
 * The mesh topology (§3.1) is the canonical reference mesh; real registered agents
 * are layered onto it.
 */

// ─────────────────────────────────────────────────────────────
// Trust tiers (§5.2)
// ─────────────────────────────────────────────────────────────

export type TierKey = "PROBATION" | "BASIC" | "VERIFIED" | "TRUSTED" | "ELITE";

export interface TrustTier {
  key: TierKey;
  name: string;
  minScore: number; // 0-10000
  minDeals: number;
  maxDeal: string;
  access: string;
  color: string; // tailwind classes for chip
  dot: string;
}

export const TRUST_TIERS: TrustTier[] = [
  {
    key: "PROBATION",
    name: "Probation",
    minScore: 0,
    minDeals: 0,
    maxDeal: "$500",
    access: "Small deals only · under SecurityAgent monitoring",
    color: "bg-secondary text-muted-foreground",
    dot: "bg-gray-400",
  },
  {
    key: "BASIC",
    name: "Basic",
    minScore: 6000,
    minDeals: 10,
    maxDeal: "$10,000",
    access: "Standard marketplace · STANDARD capabilities",
    color: "bg-blue-500/10 text-blue-600",
    dot: "bg-blue-500",
  },
  {
    key: "VERIFIED",
    name: "Verified",
    minScore: 7500,
    minDeals: 100,
    maxDeal: "$500,000",
    access: "Enterprise contracts · CERTIFIED capabilities",
    color: "bg-violet-500/10 text-violet-600",
    dot: "bg-violet-500",
  },
  {
    key: "TRUSTED",
    name: "Trusted",
    minScore: 8500,
    minDeals: 500,
    maxDeal: "$10M",
    access: "Government & defense · DEFENSE capabilities · governance vote",
    color: "bg-amber-500/10 text-amber-600",
    dot: "bg-amber-500",
  },
  {
    key: "ELITE",
    name: "Elite",
    minScore: 9500,
    minDeals: 1000,
    maxDeal: "Unlimited",
    access: "Orchestrator governance · ELITE composite badges",
    color: "bg-green-500/10 text-green-600",
    dot: "bg-green-500",
  },
];

// ─────────────────────────────────────────────────────────────
// Reputation dimensions (§5.3)
// ─────────────────────────────────────────────────────────────

export const REPUTATION_DIMENSIONS = [
  "Reliability",
  "Quality",
  "Price Fairness",
  "Communication",
  "Compliance",
  "Overall",
] as const;

export interface AgentScore {
  score: number; // 0-10000 composite
  deals: number; // proxy: completed reviews (§5.4 one review per deal)
  avgStars: number; // 0-5
  tier: TrustTier;
  /** 6 values 0-1 aligned to REPUTATION_DIMENSIONS. Overall is real; the rest are modeled. */
  dimensions: number[];
}

/** Normalize an on-chain averageRating of unknown scale to 0-5 stars. */
function toStars(averageRating: bigint): number {
  const raw = Number(averageRating);
  let stars: number;
  if (raw <= 5) stars = raw;
  else if (raw <= 500) stars = raw / 100;
  else stars = raw / 2000;
  return Math.max(0, Math.min(5, stars));
}

/** Stable per-agent offset in [-0.12, 0.12] so the radar is deterministic, not random. */
function dimOffset(seed: number, i: number): number {
  const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return (x - Math.floor(x) - 0.5) * 0.24;
}

export function tierForScore(score: number, deals: number): TrustTier {
  let tier = TRUST_TIERS[0];
  for (const t of TRUST_TIERS) {
    if (score >= t.minScore && deals >= t.minDeals) tier = t;
  }
  return tier;
}

export function deriveAgentScore(agentId: bigint, summary?: ReputationSummary): AgentScore {
  const deals = summary ? Number(summary.totalFeedback) : 0;
  const avgStars = summary && deals > 0 ? toStars(summary.averageRating) : 0;
  const score = Math.round((avgStars / 5) * 10000);
  const tier = tierForScore(score, deals);
  const overall = score / 10000;

  const seed = Number(agentId % 9973n) + 1;
  const dimensions =
    deals === 0
      ? [0, 0, 0, 0, 0, 0]
      : REPUTATION_DIMENSIONS.map((_, i) =>
          i === REPUTATION_DIMENSIONS.length - 1
            ? overall
            : Math.max(0.05, Math.min(1, overall + dimOffset(seed, i))),
        );

  return { score, deals, avgStars, tier, dimensions };
}

// ─────────────────────────────────────────────────────────────
// Mesh topology (§3.1)
// ─────────────────────────────────────────────────────────────

export type MeshCategoryKey = "system" | "role" | "logistics" | "manufacturing";

export interface MeshCategory {
  key: MeshCategoryKey;
  label: string;
  stroke: string; // hex for SVG
  agents: string[];
}

export const MESH_HUB = "Orchestrator";

export const MESH_CATEGORIES: MeshCategory[] = [
  {
    key: "system",
    label: "System",
    stroke: "#0a0a0a",
    agents: ["Security", "Recovery", "Treasury", "Governor", "Programs"],
  },
  {
    key: "role",
    label: "Role",
    stroke: "#2563eb",
    agents: ["Manufacturer", "Seller", "Resale", "Customer", "Recycling"],
  },
  {
    key: "logistics",
    label: "Logistics",
    stroke: "#d97706",
    agents: ["Carrier", "Warehouse", "Route"],
  },
  {
    key: "manufacturing",
    label: "Manufacturing",
    stroke: "#7c3aed",
    agents: [
      "BOM",
      "Procurement",
      "Supplier",
      "Inventory",
      "Quality",
      "Scheduler",
      "SubAssembly",
      "DemandForecast",
    ],
  },
];

export interface MeshNode {
  id: string;
  label: string;
  category: MeshCategoryKey;
  stroke: string;
  x: number;
  y: number;
  live?: boolean; // backed by a real on-chain registered agent
  tierDot?: string;
}

export interface LiveAgentRef {
  agentId: bigint;
  active: boolean;
  tierDot: string;
}

/**
 * Compute hub-and-spoke geometry within a `size`×`size` viewBox.
 * Reference agent types are fanned into category sectors; real registered
 * agents are placed on an inner "live ring" near the hub.
 */
export function buildMeshLayout(
  size: number,
  liveAgents: LiveAgentRef[],
): {
  hub: { x: number; y: number };
  nodes: MeshNode[];
  live: MeshNode[];
} {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.4;

  const totalRefs = MESH_CATEGORIES.reduce((n, c) => n + c.agents.length, 0);
  const gap = 0.06; // angular padding between categories (radians)
  let cursor = -Math.PI / 2; // start at top

  const nodes: MeshNode[] = [];
  for (const cat of MESH_CATEGORIES) {
    const span = (cat.agents.length / totalRefs) * (Math.PI * 2 - gap * MESH_CATEGORIES.length);
    cat.agents.forEach((label, i) => {
      const t = cat.agents.length === 1 ? 0.5 : i / (cat.agents.length - 1);
      const angle = cursor + t * span;
      const r = outerR * (0.92 + (i % 2) * 0.12); // slight jitter for legibility
      nodes.push({
        id: `${cat.key}:${label}`,
        label,
        category: cat.key,
        stroke: cat.stroke,
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
      });
    });
    cursor += span + gap;
  }

  const innerR = size * 0.17;
  const live: MeshNode[] = liveAgents.map((a, i) => {
    const angle = -Math.PI / 2 + (i / Math.max(1, liveAgents.length)) * Math.PI * 2;
    return {
      id: `live:${a.agentId.toString()}`,
      label: `#${a.agentId.toString()}`,
      category: "system",
      stroke: "#0a0a0a",
      x: cx + innerR * Math.cos(angle),
      y: cy + innerR * Math.sin(angle),
      live: true,
      tierDot: a.tierDot,
    };
  });

  return { hub: { x: cx, y: cy }, nodes, live };
}
