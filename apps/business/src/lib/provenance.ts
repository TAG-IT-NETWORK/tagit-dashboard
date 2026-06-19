"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AssetState } from "@tagit/contracts";

/*
 * Provenance Forest — "Assets as Trees" (whitepaper §8).
 *
 * Every physical product is a Merkle-style tree of NFTs: leaf components compose
 * into sub-assemblies, which compose into a root product. The root inherits the
 * provenance of every node beneath it, which is what makes the compliance queries
 * (origin, recall, carbon, sanctions, grade) answerable in one pass.
 *
 * On-chain `compose()` is roadmap (contracts Phase 3). Until it ships, real minted
 * assets are composed via a local edge store; the demo forest below carries the
 * rich attributes (origin/grade/supplier/certs/carbon) the chain doesn't hold yet.
 * Everything is shaped so it can swap to on-chain composition without UI changes.
 */

export type Grade = "COMMERCIAL" | "INDUSTRIAL" | "SPACE" | "DEFENSE" | "NUCLEAR";
export type NodeKind = "root" | "subassembly" | "leaf";

/** Increasing criticality (whitepaper §9.4). A node is grade-compliant for an
 *  assembly if its rank >= the assembly's required rank. */
export const GRADE_RANK: Record<Grade, number> = {
  COMMERCIAL: 0,
  INDUSTRIAL: 1,
  SPACE: 2,
  DEFENSE: 3,
  NUCLEAR: 4,
};

/** Country code -> display flag + name. US is the trusted/domestic baseline. */
export const COUNTRIES: Record<string, { flag: string; name: string }> = {
  US: { flag: "🇺🇸", name: "United States" },
  DE: { flag: "🇩🇪", name: "Germany" },
  JP: { flag: "🇯🇵", name: "Japan" },
  CN: { flag: "🇨🇳", name: "China" },
  KP: { flag: "🇰🇵", name: "North Korea" },
  "—": { flag: "🏳️", name: "Unspecified" },
};

export interface ProvNode {
  id: string; // "demo:modely" or "chain:42"
  label: string;
  kind: NodeKind;
  origin: string; // ISO-2 country code, or "—" when unverified
  grade: Grade;
  supplier: string;
  sanctioned?: boolean; // supplier on a sanctions list
  certifications: string[];
  state: number; // AssetState 0..6
  flagged?: boolean; // currently FLAGGED / recalled
  batch?: string; // manufacturing lot id (recall targeting)
  carbonKg?: number; // embodied + transport carbon for this node
  tokenId?: string; // real on-chain token id when chain-backed
  verified: boolean; // true = attributes are on-chain facts / demo certified
  children: ProvNode[];
}

// ─────────────────────────────────────────────────────────────
// Tree walking + compliance engine (pure functions)
// ─────────────────────────────────────────────────────────────

export function flatten(node: ProvNode): ProvNode[] {
  return [node, ...node.children.flatMap(flatten)];
}

export function countNodes(node: ProvNode): number {
  return 1 + node.children.reduce((sum, c) => sum + countNodes(c), 0);
}

export function treeDepth(node: ProvNode): number {
  if (node.children.length === 0) return 1;
  return 1 + Math.max(...node.children.map(treeDepth));
}

export interface OriginResult {
  nonUS: ProvNode[];
  /** Components whose origin is unverified ("—") — must not be treated as clean. */
  unknown: ProvNode[];
  byCountry: { code: string; count: number }[];
}

export function originAudit(root: ProvNode): OriginResult {
  const all = flatten(root);
  const known = all.filter((n) => n.origin !== "—");
  const counts = new Map<string, number>();
  for (const n of known) counts.set(n.origin, (counts.get(n.origin) ?? 0) + 1);
  const unknown = all.filter((n) => n.origin === "—");
  if (unknown.length > 0) counts.set("—", unknown.length);
  return {
    nonUS: known.filter((n) => n.origin !== "US"),
    unknown,
    byCountry: [...counts.entries()]
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count),
  };
}

export function recallAudit(root: ProvNode): ProvNode[] {
  return flatten(root).filter((n) => n.flagged);
}

export function carbonFootprint(root: ProvNode): number {
  return flatten(root).reduce((sum, n) => sum + (n.carbonKg ?? 0), 0);
}

export function sanctionedAudit(root: ProvNode): ProvNode[] {
  return flatten(root).filter((n) => n.sanctioned);
}

/** Components whose grade is below the root product's required grade. */
export function gradeAudit(root: ProvNode): { required: Grade; violations: ProvNode[] } {
  const required = root.grade;
  const violations = flatten(root).filter(
    (n) => n.id !== root.id && GRADE_RANK[n.grade] < GRADE_RANK[required],
  );
  return { required, violations };
}

export interface RecallHit {
  root: ProvNode;
  affected: ProvNode[]; // nodes in this tree matching the batch
}

/** Find every root product in the forest containing a component from `batch`. */
export function recallByBatch(forest: ProvNode[], batch: string): RecallHit[] {
  const hits: RecallHit[] = [];
  for (const root of forest) {
    const affected = flatten(root).filter((n) => n.batch === batch);
    if (affected.length > 0) hits.push({ root, affected });
  }
  return hits;
}

/** All distinct batch ids present in the forest, with whether any are flagged. */
export function listBatches(forest: ProvNode[]): { batch: string; flagged: boolean }[] {
  const map = new Map<string, boolean>();
  for (const root of forest) {
    for (const n of flatten(root)) {
      if (!n.batch) continue;
      map.set(n.batch, (map.get(n.batch) ?? false) || !!n.flagged);
    }
  }
  return [...map.entries()].map(([batch, flagged]) => ({ batch, flagged }));
}

// ─────────────────────────────────────────────────────────────
// Demo forest — rich, certified sample trees (whitepaper §8.2, §9)
// ─────────────────────────────────────────────────────────────

function leaf(p: Partial<ProvNode> & { id: string; label: string }): ProvNode {
  return {
    kind: "leaf",
    origin: "US",
    grade: "INDUSTRIAL",
    supplier: "—",
    certifications: [],
    state: AssetState.ACTIVATED,
    verified: true,
    children: [],
    ...p,
  };
}

export const DEMO_FOREST: ProvNode[] = [
  {
    id: "demo:modely",
    label: "Tesla Model Y — VIN root",
    kind: "root",
    origin: "US",
    grade: "INDUSTRIAL",
    supplier: "Gigafactory Texas",
    certifications: ["ISO-9001"],
    state: AssetState.CLAIMED,
    carbonKg: 1200,
    verified: true,
    children: [
      {
        ...leaf({ id: "demo:my-fua", label: "Front Underbody Assembly" }),
        kind: "subassembly",
        supplier: "Giga Press Line 1",
        carbonKg: 320,
        children: [
          leaf({
            id: "demo:my-cast",
            label: "Giga Press Casting",
            supplier: "Tesla",
            carbonKg: 210,
          }),
          leaf({ id: "demo:my-rails", label: "Crash Rails", supplier: "Tesla", carbonKg: 60 }),
        ],
      },
      {
        ...leaf({ id: "demo:my-batt", label: "Battery Pack Assembly" }),
        kind: "subassembly",
        supplier: "Panasonic / Tesla",
        certifications: ["ISO-9001"],
        carbonKg: 480,
        children: [
          leaf({
            id: "demo:my-cellA",
            label: "Cell Module A — lot B-77",
            origin: "CN",
            supplier: "Contemporary Cells Co.",
            state: AssetState.FLAGGED,
            flagged: true,
            batch: "B-77",
            carbonKg: 140,
          }),
          leaf({
            id: "demo:my-bms",
            label: "Battery Management System",
            certifications: ["ISO-9001"],
            carbonKg: 22,
          }),
          leaf({
            id: "demo:my-cool",
            label: "Cooling System",
            origin: "DE",
            supplier: "Bosch",
            carbonKg: 38,
          }),
        ],
      },
      {
        ...leaf({ id: "demo:my-drive", label: "Rear Drive Unit" }),
        kind: "subassembly",
        supplier: "Tesla",
        carbonKg: 160,
        children: [
          leaf({
            id: "demo:my-stator",
            label: "Stator",
            origin: "CN",
            supplier: "Broad Motor Ltd.",
            carbonKg: 70,
          }),
          leaf({ id: "demo:my-inv", label: "Inverter (SiC)", supplier: "Tesla", carbonKg: 30 }),
        ],
      },
    ],
  },
  {
    id: "demo:surgrobot",
    label: "Surgical Robot — ACL Repair Arm",
    kind: "root",
    origin: "US",
    grade: "DEFENSE",
    supplier: "Medtronic Robotics",
    certifications: ["ISO-13485", "FDA-510k"],
    state: AssetState.ACTIVATED,
    carbonKg: 90,
    verified: true,
    children: [
      {
        ...leaf({ id: "demo:sr-act", label: "Titanium Actuator Assembly", grade: "DEFENSE" }),
        kind: "subassembly",
        supplier: "Precision Aerostructures",
        certifications: ["MIL-SPEC", "AS9100"],
        carbonKg: 40,
        children: [
          leaf({
            id: "demo:sr-rod",
            label: "Ti-6Al-4V Rod (sterile)",
            grade: "DEFENSE",
            supplier: "Allegheny Tech",
            certifications: ["MIL-SPEC", "Sterility"],
            carbonKg: 18,
          }),
          leaf({
            id: "demo:sr-servo",
            label: "Precision Servo",
            origin: "JP",
            supplier: "Harmonic Drive",
            carbonKg: 12,
          }),
        ],
      },
      {
        ...leaf({
          id: "demo:sr-optics",
          label: "Optics Module",
          origin: "DE",
          grade: "INDUSTRIAL",
        }),
        kind: "subassembly",
        supplier: "Zeiss",
        carbonKg: 20,
        children: [
          leaf({
            id: "demo:sr-sensor",
            label: "Image Sensor",
            origin: "CN",
            supplier: "Redwave Optoelectronics (OFAC)",
            sanctioned: true,
            carbonKg: 8,
          }),
          leaf({
            id: "demo:sr-lens",
            label: "Objective Lens",
            origin: "DE",
            supplier: "Zeiss",
            carbonKg: 6,
          }),
        ],
      },
    ],
  },
  {
    id: "demo:satbus",
    label: "Satellite Bus — LEO Comms",
    kind: "root",
    origin: "US",
    grade: "SPACE",
    supplier: "Orbital Systems Inc.",
    certifications: ["AS9100", "ITAR"],
    state: AssetState.BOUND,
    carbonKg: 300,
    verified: true,
    children: [
      {
        ...leaf({ id: "demo:sat-power", label: "Power Subsystem", grade: "SPACE" }),
        kind: "subassembly",
        supplier: "Orbital Systems",
        certifications: ["AS9100"],
        carbonKg: 120,
        children: [
          leaf({
            id: "demo:sat-array",
            label: "Solar Array (deployable)",
            grade: "SPACE",
            supplier: "SolAero",
            carbonKg: 80,
          }),
          leaf({
            id: "demo:sat-ctrl",
            label: "RadHard Power Controller",
            grade: "SPACE",
            supplier: "BAE Systems",
            certifications: ["MIL-SPEC", "RadHard"],
            carbonKg: 14,
          }),
        ],
      },
      {
        ...leaf({ id: "demo:sat-avi", label: "Avionics Subsystem", grade: "SPACE" }),
        kind: "subassembly",
        supplier: "Orbital Systems",
        carbonKg: 95,
        children: [
          leaf({
            id: "demo:sat-fc",
            label: "Flight Computer",
            grade: "SPACE",
            supplier: "Moog",
            certifications: ["RadHard"],
            carbonKg: 20,
          }),
          leaf({
            id: "demo:sat-rf",
            label: "RF Module",
            origin: "CN",
            grade: "COMMERCIAL",
            supplier: "Huatech RF (OFAC)",
            sanctioned: true,
            batch: "RF-CN-04",
            carbonKg: 10,
          }),
        ],
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────
// Composition store — real minted assets composed via local edges
// ─────────────────────────────────────────────────────────────

const EDGES_KEY = "tagit-provenance-edges";

type EdgeMap = Record<string, string[]>; // rootTokenId -> childTokenId[]

function readEdges(): EdgeMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(EDGES_KEY);
    return raw ? (JSON.parse(raw) as EdgeMap) : {};
  } catch {
    return {};
  }
}

export interface ChainAsset {
  tokenId: bigint;
  owner: `0x${string}`;
  state: number;
}

/** A real on-chain asset rendered as a provenance node (facts only, unverified attrs). */
function chainNode(asset: ChainAsset, kind: NodeKind): ProvNode {
  return {
    id: `chain:${asset.tokenId.toString()}`,
    label: `Product #${asset.tokenId.toString()}`,
    kind,
    origin: "—",
    grade: "COMMERCIAL",
    supplier: `${asset.owner.slice(0, 6)}…${asset.owner.slice(-4)}`,
    certifications: [],
    state: asset.state,
    flagged: asset.state === AssetState.FLAGGED,
    tokenId: asset.tokenId.toString(),
    verified: false,
    children: [],
  };
}

/**
 * Build the full forest: demo trees + real assets composed by the local edge map.
 * Real assets that are a child of some root are not also shown as standalone roots.
 */
export function useProvenanceForest(assets: ChainAsset[]) {
  const [edges, setEdges] = useState<EdgeMap>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setEdges(readEdges());
    setLoaded(true);
  }, []);

  const persist = useCallback((next: EdgeMap) => {
    // Drop empty arrays to keep the store tidy.
    const cleaned: EdgeMap = {};
    for (const [k, v] of Object.entries(next)) if (v.length > 0) cleaned[k] = v;
    window.localStorage.setItem(EDGES_KEY, JSON.stringify(cleaned));
    setEdges(cleaned);
  }, []);

  const attach = useCallback(
    (rootTokenId: string, childTokenId: string) => {
      if (rootTokenId === childTokenId) return;
      const current = readEdges();
      const list = new Set(current[rootTokenId] ?? []);
      list.add(childTokenId);
      persist({ ...current, [rootTokenId]: [...list] });
    },
    [persist],
  );

  const detach = useCallback(
    (rootTokenId: string, childTokenId: string) => {
      const current = readEdges();
      persist({
        ...current,
        [rootTokenId]: (current[rootTokenId] ?? []).filter((c) => c !== childTokenId),
      });
    },
    [persist],
  );

  const chainForest = useMemo(() => {
    const byId = new Map(assets.map((a) => [a.tokenId.toString(), a]));
    const childIds = new Set(Object.values(edges).flat());

    const build = (tokenId: string, kind: NodeKind, seen: Set<string>): ProvNode | null => {
      const asset = byId.get(tokenId);
      if (!asset || seen.has(tokenId)) return null;
      seen.add(tokenId);
      const kids = (edges[tokenId] ?? [])
        .map((c) => build(c, "leaf", seen))
        .filter((n): n is ProvNode => n !== null);
      const node = chainNode(asset, kids.length > 0 ? "subassembly" : kind);
      node.children = kids;
      return node;
    };

    // Roots = real assets that are not a child of any other asset.
    return assets
      .filter((a) => !childIds.has(a.tokenId.toString()))
      .map((a) => build(a.tokenId.toString(), "root", new Set<string>()))
      .filter((n): n is ProvNode => n !== null)
      .map((n) => ({ ...n, kind: "root" as NodeKind }));
  }, [assets, edges]);

  const forest = useMemo(() => [...DEMO_FOREST, ...chainForest], [chainForest]);

  return { forest, demoForest: DEMO_FOREST, chainForest, attach, detach, loaded };
}
