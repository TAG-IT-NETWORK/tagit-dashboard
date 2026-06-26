"use client";

import { useEffect, useState } from "react";
import { useChainId, useWatchContractEvent } from "wagmi";
import { TAGITCoreABI, getContractsForChain } from "@tagit/contracts";

/*
 * Lifecycle Command Center model (whitepaper §7).
 *
 * Primary states (0-6) are written on-chain by TAGITCore and are the source of
 * truth. Sub-states are managed off-chain by domain agents (kept off-chain by
 * design to hold gas down), so here they are the reference taxonomy plus
 * heuristic bottleneck detection from real on-chain signals (flags + dwell time).
 */

export interface PrimaryState {
  id: number;
  key: string;
  name: string;
  description: string;
  phase: "pre" | "manufacturing" | "consumer" | "recovery";
  dot: string; // tailwind text color for the status dot
}

export const PRIMARY_STATES: PrimaryState[] = [
  {
    id: 0,
    key: "NONE",
    name: "None",
    description: "Design / BOM only. NFT queued but not yet minted.",
    phase: "pre",
    dot: "bg-gray-400",
  },
  {
    id: 1,
    key: "MINTED",
    name: "Minted",
    description: "NFT exists on-chain. NFC chip not yet bound to the item.",
    phase: "manufacturing",
    dot: "bg-zinc-500",
  },
  {
    id: 2,
    key: "BOUND",
    name: "Bound",
    description: "NFC tag cryptographically linked. Awaiting QC / certification.",
    phase: "manufacturing",
    dot: "bg-blue-500",
  },
  {
    id: 3,
    key: "ACTIVATED",
    name: "Activated",
    description: "QC passed, certified — the operational state (6 phases).",
    phase: "manufacturing",
    dot: "bg-green-500",
  },
  {
    id: 4,
    key: "CLAIMED",
    name: "Claimed",
    description: "Owned by an end customer. Warranty, service, resale.",
    phase: "consumer",
    dot: "bg-purple-500",
  },
  {
    id: 5,
    key: "FLAGGED",
    name: "Flagged",
    description: "Lost / stolen / recall / quality hold under investigation.",
    phase: "recovery",
    dot: "bg-red-500",
  },
  {
    id: 6,
    key: "RECYCLED",
    name: "Recycled",
    description: "End of life. Components recovered, NFT burned.",
    phase: "recovery",
    dot: "bg-orange-500",
  },
];

export type SubStateKind = "normal" | "hold" | "fail";

export interface SubState {
  name: string;
  description: string;
  kind?: SubStateKind;
}

/** The sub-state model — domain-agent managed, off-chain (whitepaper §7.1). */
export const SUB_STATES: Record<number, SubState[]> = {
  0: [
    { name: "DESIGN_PHASE", description: "Exists in CAD/BOM only. NFT queued." },
    {
      name: "BOM_LISTED",
      description: "Added to Bill of Materials. ProcurementAgent has visibility.",
    },
    { name: "PROCUREMENT_TRIGGERED", description: "BOMAgent initiated the RFQ process." },
    { name: "SUPPLIER_SELECTED", description: "Winning supplier chosen. Awaiting production." },
    { name: "PRODUCTION_QUEUED", description: "Supplier accepted PO, added to schedule." },
  ],
  1: [
    { name: "AWAITING_BIND", description: "NFT on-chain. NFC chip not yet attached." },
    { name: "IN_PRODUCTION", description: "Item actively being manufactured." },
    {
      name: "PRODUCTION_HOLD",
      description: "Paused: material shortage, equipment, or QC hold.",
      kind: "hold",
    },
    { name: "READY_FOR_BIND", description: "Physical item complete. Binding scheduled." },
    { name: "BATCH_ASSIGNED", description: "Grouped into a shipment batch." },
    { name: "AWAITING_FIRST_QC", description: "Pending initial quality inspection." },
  ],
  2: [
    { name: "PENDING_QC", description: "NFC bound. Awaiting first QualityAgent inspection." },
    { name: "IN_QC", description: "QualityAgent actively running inspection." },
    { name: "QC_PASSED", description: "Inspection passed. Cleared for activation." },
    {
      name: "QC_FAILED",
      description: "Failed inspection. Routes to FLAGGED or RECYCLED.",
      kind: "fail",
    },
    {
      name: "THIRD_PARTY_CERT",
      description: "External certification in progress (ISO/FDA/MIL-SPEC).",
    },
    { name: "CERTIFIED", description: "All required certifications complete and on-chain." },
    { name: "STAGED_FOR_SHIPMENT", description: "Staged. CarrierAgent negotiation open." },
    {
      name: "SUB_ASSEMBLY_PENDING",
      description: "Waiting to be incorporated into a larger assembly.",
    },
    { name: "STERILIZED", description: "(Medical) Post-sterilization NFC confirmation complete." },
    {
      name: "STERILITY_CERTIFIED",
      description: "Sterility chain validated by CertificationAgent.",
    },
  ],
  3: [
    { name: "RFQ_BROADCAST", description: "Procurement — quote requests sent to SupplierAgents." },
    { name: "BIDS_RECEIVED", description: "Procurement — SupplierAgents responded with pricing." },
    { name: "PO_ISSUED", description: "Procurement — purchase order confirmed." },
    { name: "IN_TRANSIT", description: "Transit — CarrierAgent holds custody, moving." },
    { name: "AT_WAREHOUSE", description: "Warehousing — inbound NFC-scanned, live inventory." },
    { name: "OUT_FOR_DELIVERY", description: "Last Mile — final leg to destination." },
    { name: "STAGED_FOR_ASSEMBLY", description: "Assembly — arrived at production staging." },
    { name: "IN_ASSEMBLY", description: "Assembly — being incorporated into a larger unit." },
    {
      name: "SUB_ASSEMBLY_BOUND",
      description: "Assembly — component NFT linked to sub-assembly NFT.",
    },
    {
      name: "FINAL_ASSEMBLY_BOUND",
      description: "Assembly — sub-assembly linked to finished product.",
    },
    { name: "POST_ASSEMBLY_TEST", description: "Assembly — completed unit under functional test." },
    { name: "TEST_PASSED", description: "Assembly — all tests passed. Ready to ship." },
    {
      name: "TEST_FAILED",
      description: "Assembly — functional test failed. Routes to FLAGGED.",
      kind: "fail",
    },
  ],
  4: [
    { name: "PENDING_HANDOFF", description: "Awaiting final custody handoff to customer." },
    { name: "NFC_VERIFIED", description: "Customer scan confirmed at destination." },
    { name: "OWNERSHIP_CONFIRMED", description: "On-chain ownership transferred to customer." },
    { name: "UNDER_WARRANTY", description: "Active warranty period." },
    { name: "WARRANTY_CLAIMED", description: "Warranty claim filed and tracked." },
    { name: "RESALE_LISTED", description: "Listed on the secondary market." },
    { name: "IN_SERVICE", description: "Deployed and operational." },
    { name: "IN_MAINTENANCE", description: "Undergoing service or repair." },
  ],
  5: [
    { name: "SUSPECTED_COUNTERFEIT", description: "Authenticity in question.", kind: "fail" },
    { name: "STOLEN", description: "Reported stolen.", kind: "fail" },
    { name: "QUALITY_HOLD", description: "Held pending quality investigation.", kind: "hold" },
    { name: "CUSTOMS_SEIZED", description: "Seized at a border crossing.", kind: "hold" },
    { name: "LEGAL_HOLD", description: "Held under legal process.", kind: "hold" },
    { name: "DAMAGE_REPORTED", description: "Physical damage reported in custody.", kind: "fail" },
    { name: "STERILITY_BREACH", description: "(Medical) Sterility chain broken.", kind: "fail" },
    { name: "RECALL_ISSUED", description: "Manufacturer recall active.", kind: "fail" },
    { name: "FRAUD_CONFIRMED", description: "Fraud confirmed by SecurityAgent.", kind: "fail" },
    { name: "QUARANTINED", description: "Isolated pending resolution.", kind: "hold" },
  ],
  6: [
    { name: "DECOMMISSION_INITIATED", description: "End-of-life routing started." },
    { name: "IN_TRANSIT_TO_FACILITY", description: "Moving to a certified recycling facility." },
    { name: "AT_FACILITY", description: "Received at the facility." },
    { name: "COMPONENTS_RECOVERY", description: "Reusable components recovered." },
    { name: "DECOMMISSION_CERTIFIED", description: "Decommission certified on-chain." },
    { name: "NFT_BURN_PENDING", description: "Awaiting final NFT burn." },
    { name: "COMPLETE", description: "Lifecycle closed. Terminal state." },
  ],
};

export interface AuthorityRow {
  transition: string;
  authority: string;
  verification: string;
}

/** State Transition Authority Matrix (whitepaper §7.2). */
export const AUTHORITY_MATRIX: AuthorityRow[] = [
  {
    transition: "NONE → MINTED",
    authority: "ManufacturerAgent + OrchestratorAgent",
    verification: "Supplier identity + BOM match",
  },
  {
    transition: "MINTED → BOUND",
    authority: "ManufacturerAgent + InspectorAgent",
    verification: "NFC challenge-response confirmation",
  },
  {
    transition: "BOUND → ACTIVATED",
    authority: "OrchestratorAgent",
    verification: "QC passed + all certifications complete",
  },
  {
    transition: "ACTIVATED → CLAIMED",
    authority: "CustomerAgent + OrchestratorAgent",
    verification: "NFC scan at destination + ownership",
  },
  {
    transition: "CLAIMED → FLAGGED",
    authority: "EnforcerAgent or RecoveryAgent",
    verification: "IPFS evidence + SecurityAgent notification",
  },
  {
    transition: "Any → RECYCLED",
    authority: "RecyclingAgent + OrchestratorAgent",
    verification: "Certified facility receipt + decommission auth",
  },
  {
    transition: "FLAGGED → Prior State",
    authority: "EnforcerAgent + SecurityAgent",
    verification: "Investigation resolution record on-chain",
  },
];

// ─────────────────────────────────────────────────────────────
// Bottleneck heuristics from real on-chain signals
// ─────────────────────────────────────────────────────────────

/** Dwell-time (days) after which an asset in a given state is considered stale. */
const STALE_DAYS: Record<number, number> = {
  1: 7, // MINTED — should bind quickly
  2: 14, // BOUND — should pass QC + activate
  3: 30, // ACTIVATED — in commerce/assembly longer
};

export function daysInState(timestamp: bigint): number {
  if (timestamp <= 0n) return 0;
  const ms = Date.now() - Number(timestamp) * 1000;
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export interface LifecycleAsset {
  tokenId: bigint;
  state: number;
  timestamp: bigint;
  flags: number;
}

export function isStale(asset: LifecycleAsset): boolean {
  const threshold = STALE_DAYS[asset.state];
  return threshold !== undefined && daysInState(asset.timestamp) >= threshold;
}

export function isBottleneck(asset: LifecycleAsset): boolean {
  return asset.state === 5 /* FLAGGED */ || isStale(asset);
}

// ─────────────────────────────────────────────────────────────
// Live StateChanged feed (real on-chain events)
// ─────────────────────────────────────────────────────────────

export interface StateChangeEvent {
  id: string;
  tokenId: bigint;
  from: number;
  to: number;
  actor: `0x${string}`;
  blockNumber: bigint;
}

/** Watches TAGITCore StateChanged events and accumulates them (newest first). */
export function useLiveStateChanges(max = 20) {
  const chainId = useChainId();
  const [events, setEvents] = useState<StateChangeEvent[]>([]);
  const contracts = getContractsForChain(chainId);

  useWatchContractEvent({
    address: contracts.TAGITCore,
    abi: TAGITCoreABI,
    eventName: "StateChanged",
    chainId,
    onLogs(logs) {
      setEvents((prev) => {
        const next: StateChangeEvent[] = logs
          .map((log) => {
            const args = (log as unknown as { args?: Record<string, unknown> }).args ?? {};
            const lg = log as unknown as {
              transactionHash?: string;
              logIndex?: number;
              blockNumber?: bigint;
            };
            if (args.tokenId === undefined) return null;
            return {
              id: `${lg.transactionHash ?? "live"}-${lg.logIndex ?? 0}`,
              tokenId: args.tokenId as bigint,
              from: Number(args.from ?? 0),
              to: Number(args.to ?? 0),
              actor: (args.actor as `0x${string}`) ?? "0x0000000000000000000000000000000000000000",
              blockNumber: lg.blockNumber ?? 0n,
            };
          })
          .filter((e): e is StateChangeEvent => e !== null);
        const merged = [...next.reverse(), ...prev];
        const seen = new Set<string>();
        return merged
          .filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)))
          .slice(0, max);
      });
    },
  });

  return events;
}
