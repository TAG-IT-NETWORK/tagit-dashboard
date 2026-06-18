"use client";

import { AssetState } from "@tagit/contracts";

/*
 * Network / Trust Economy metrics model.
 *
 * Real on-chain signals (asset counts, lifecycle states, transitions, agents) are
 * the spine. The fraud figures and addressable-market TAM are the whitepaper's
 * macro context (§1.1, §1.4, §9). The "value secured" figure is an explicit
 * notional model — the per-asset assumption is shown on screen, never as a fact.
 */

export interface FraudDomain {
  domain: string;
  loss: string; // display
  lossValue: number; // USD, for bar scaling (0 = unquantified)
  rootCause: string;
}

/** The trust crisis TAG IT closes (whitepaper §1.1). */
export const FRAUD_DOMAINS: FraudDomain[] = [
  {
    domain: "Counterfeit goods",
    loss: "$4.5T/yr",
    lossValue: 4_500_000_000_000,
    rootCause: "No verifiable provenance",
  },
  {
    domain: "Electronics counterfeiting",
    loss: "$169B/yr",
    lossValue: 169_000_000_000,
    rootCause: "No component-level NFC",
  },
  {
    domain: "Pharmaceutical diversion",
    loss: "$200B/yr",
    lossValue: 200_000_000_000,
    rootCause: "No custody chain",
  },
  {
    domain: "Food fraud",
    loss: "$40B/yr",
    lossValue: 40_000_000_000,
    rootCause: "No farm-to-fork tracking",
  },
  {
    domain: "Aviation part fraud",
    loss: "$2B/yr",
    lossValue: 2_000_000_000,
    rootCause: "Paper-based certificates",
  },
  {
    domain: "Defense supply chain",
    loss: "Classified",
    lossValue: 0,
    rootCause: "No cryptographic proof of origin",
  },
];

export const FRAUD_MAX = Math.max(...FRAUD_DOMAINS.map((f) => f.lossValue));

export interface MarketDomain {
  key: string;
  name: string;
  tam: string;
  blurb: string;
  status: "live" | "ready" | "roadmap";
}

/** Addressable domains (whitepaper §9 + §1.4). */
export const MARKET_DOMAINS: MarketDomain[] = [
  {
    key: "ecommerce",
    name: "E-Commerce",
    tam: "$4.8B auth · $26B SCM",
    blurb: "Agent-negotiated marketplace. Escrow releases on delivery NFC scan.",
    status: "live",
  },
  {
    key: "automotive",
    name: "Automotive / EV",
    tam: "$50B+ by 2030",
    blurb: "10,000-component provenance trees. 60-second recalls.",
    status: "ready",
  },
  {
    key: "medical",
    name: "Medical Devices",
    tam: "$8.4B (2025)",
    blurb: "Sterility chains. Robot won't activate on a provenance gap.",
    status: "ready",
  },
  {
    key: "defense",
    name: "Defense",
    tam: "$12B+ US DoD",
    blurb: "ITAR / CMMC 2.0 compliance. Private permissioned chain.",
    status: "roadmap",
  },
  {
    key: "space",
    name: "Space Systems",
    tam: "$18B by 2030",
    blurb: "Component grading. QualityAgent blocks grade mismatches.",
    status: "roadmap",
  },
];

export const INITIAL_TAM = "$88B+";

/** Per-asset notional value for the "value secured" model (clearly an assumption). */
export const NOTIONAL_VALUE_USD = 850;

export interface NetworkAsset {
  state: number;
}

/**
 * Approximate on-chain state transitions: every asset advanced from NONE to its
 * current state, so its state index ≈ the number of recorded transitions/scans.
 */
export function countTransitions(assets: NetworkAsset[]): number {
  return assets.reduce((n, a) => n + Math.max(0, a.state), 0);
}

/** Assets caught by the network (FLAGGED) — real fraud/recovery signal. */
export function countFlagged(assets: NetworkAsset[]): number {
  return assets.filter((a) => a.state === AssetState.FLAGGED).length;
}

export function formatUsd(value: number): string {
  if (value >= 1_000_000_000_000) return `$${(value / 1_000_000_000_000).toFixed(1)}T`;
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toLocaleString()}`;
}
