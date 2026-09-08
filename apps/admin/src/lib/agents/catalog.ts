/**
 * Agent Catalog — every agent of the TAG IT mesh in one registry: the
 * whitepaper's taxonomy (v1.23, §3 Role / Logistics / Manufacturing / System
 * agents, §4 the six capability agents), the agents that already run in
 * tagit-services, and a few suggested ones the paper does not name yet.
 *
 * Status vocabulary (honest, per agent):
 *   live     — runs today; the card can call it
 *   beta     — the rails exist (endpoints, pages) but the agent logic is thin
 *   planned  — in the whitepaper, not built
 *   proposed — not in the whitepaper; suggested here
 */

export type AgentFamily = "system" | "capability" | "role" | "logistics" | "manufacturing" | "growth" | "proposed";
export type AgentStatus = "live" | "beta" | "planned" | "proposed";

export interface AgentSkillSample {
  id: string;
  label: string;
  sample: Record<string, unknown>;
}

export interface CatalogAgent {
  id: string;
  name: string;
  family: AgentFamily;
  status: AgentStatus;
  summary: string;
  responsibilities: string[];
  source: "whitepaper" | "code" | "suggested";
  /** Whitepaper section or code path. */
  ref?: string;
  /** Deployed once per partner (carrier, supplier, facility) — a template to fork. */
  perPartner?: boolean;
  /** Existing console pages / rails this agent already leans on. */
  links?: Array<{ label: string; href: string }>;
  /** A2A skills the card can run through /api/a2a. */
  skills?: AgentSkillSample[];
  /** Special interactive panel. */
  panel?: "logistics";
}

export const FAMILY_LABELS: Record<AgentFamily, string> = {
  system: "System agents",
  capability: "Capability agents (BIDGES)",
  role: "Role agents",
  logistics: "Logistics agents",
  manufacturing: "Manufacturing agents",
  growth: "Growth & operations (running today)",
  proposed: "Proposed — not in the whitepaper yet",
};

export const STATUS_LABELS: Record<AgentStatus, string> = {
  live: "Live",
  beta: "Beta",
  planned: "Planned",
  proposed: "Proposed",
};

const wp = (ref: string) => ({ source: "whitepaper" as const, ref });
const code = (ref: string) => ({ source: "code" as const, ref });
const idea = () => ({ source: "suggested" as const });

export const AGENT_CATALOG: CatalogAgent[] = [
  // ── System agents (§3.x, §6) ────────────────────────────────────────────
  {
    id: "orchestrator",
    name: "OrchestratorAgent (TAGITCore)",
    family: "system",
    status: "live",
    summary: "The on-chain core: validates every primary lifecycle transition (7 states) and owns the asset ↔ tag binding.",
    responsibilities: ["Validates MINTED → BOUND → ACTIVATED → CLAIMED transitions", "Holds the tag hash ↔ token binding", "Anchors the metadata hash per version", "Enforces capabilities through TAGITAccess"],
    ...wp("§3.1, §7"),
    links: [{ label: "Assets registry", href: "/assets" }, { label: "Capabilities", href: "/capabilities" }],
  },
  {
    id: "security",
    name: "SecurityAgent",
    family: "system",
    status: "beta",
    summary: "The immune system of the mesh: the only entity that grants, modifies or revokes capabilities and badges, with a continuous behavioral analysis loop.",
    responsibilities: ["Grants/revokes standard capabilities autonomously", "Suspends agents under investigation, PROBATION monitoring", "Detects review manipulation and Sybil patterns", "Proposes DEFENSE_CLEARED grants and bans to governance"],
    ...wp("§6"),
    links: [{ label: "Capabilities", href: "/capabilities" }, { label: "Badges", href: "/badges" }],
  },
  {
    id: "recovery",
    name: "RecoveryAgent",
    family: "system",
    status: "live",
    summary: "Opens investigation cases for tagged assets and scores risk from verification + anomaly signals; the Resolver half auto-approves recovery resolutions.",
    responsibilities: ["Opens a recovery case per asset", "Combined risk assessment (verification + anomaly)", "Drives the FLAGGED → resolve round (Resolver agent)"],
    ...code("services/src/agents/recovery-agent.ts, recovery/resolver-agent.ts"),
    links: [{ label: "AI Agents (Resolver panel)", href: "/agents" }, { label: "Resolve", href: "/resolve" }],
    skills: [
      { id: "recovery__assess_risk", label: "Assess risk of token 56", sample: { tokenId: "56" } },
      { id: "recovery__open_case", label: "Open a case for token 56", sample: { tokenId: "56", reason: "catalog test" } },
    ],
  },
  {
    id: "treasury",
    name: "TreasuryAgent",
    family: "system",
    status: "beta",
    summary: "Settlement and escrow for deals: USDC today, fiat bridges and FX oracle required for global supply chains.",
    responsibilities: ["Escrow + settle on sale (claim rail)", "Payment pattern monitoring with SecurityAgent", "Multi-currency settlement (needs FiatBridgeAgent)"],
    ...wp("§5, §10"),
    links: [{ label: "Treasury", href: "/treasury" }, { label: "Tokenomics", href: "/tokenomics" }],
  },
  {
    id: "governor",
    name: "GovernorAgent",
    family: "system",
    status: "beta",
    summary: "Proposal thresholds and votes over the mesh's parameters; the Timelock executes what passes.",
    responsibilities: ["Proposal lifecycle", "Timelock-executed parameter changes", "Emergency actions with quorum"],
    ...wp("§3.x"),
    links: [{ label: "Governance", href: "/governance" }],
  },
  {
    id: "programs",
    name: "ProgramsAgent",
    family: "system",
    status: "planned",
    summary: "Runs ecosystem programs: incentives, grants and onboarding tracks for new agents.",
    responsibilities: ["Program enrollment and payouts", "Milestone verification against on-chain events"],
    ...wp("§3.x"),
  },
  {
    id: "anchor-reconciler",
    name: "Anchor reconciler",
    family: "system",
    status: "live",
    summary: "The metadata guardian running every 5 minutes: mirrors binds, anchors pending versions, detects drift with a witness RPC and self-heals.",
    responsibilities: ["Anchors pending metadata versions", "Witness-RPC drift detection + self-heal", "Bind → catalog mirror, chain_state null-fill"],
    ...code("services/src/workers/reconciler.ts"),
    links: [{ label: "Dashboard", href: "/dashboard" }],
  },
  // ── Capability agents (§4.2) ────────────────────────────────────────────
  {
    id: "brand",
    name: "BrandAgent",
    family: "capability",
    status: "beta",
    summary: "Guardian of brand identity: canonical product records, brand attestations, inspection criteria for InspectorAgent.",
    responsibilities: ["Canonical record of what a product should look like", "Brand attestations and template publishing", "Counterfeit reports → EnforcerAgent"],
    ...wp("§4.2"),
    links: [{ label: "Catalog", href: "/catalog" }],
  },
  {
    id: "inspector",
    name: "InspectorAgent",
    family: "capability",
    status: "live",
    summary: "The verification engine: every NFC scan and state transition runs the verification protocol; it cannot be bypassed.",
    responsibilities: ["5-signal NFC scan verification", "Blocks transitions on failure", "Flags anomalies to RecoveryAgent and EnforcerAgent"],
    ...code("services/src/agents/verification-agent.ts, lib/verify-core.ts"),
    links: [{ label: "Verify (desktop reader)", href: "/verify" }],
    skills: [{ id: "verification__verify_nfc_scan", label: "Verify a sample scan payload", sample: { tokenId: "56", uid: "04727F8AFF1890", counter: 1 } }],
  },
  {
    id: "distributor",
    name: "DistributorAgent",
    family: "capability",
    status: "planned",
    summary: "Movement permissions: who may take custody, from whom, under what conditions, to where; certifies distribution channels.",
    responsibilities: ["Custody permission matrix", "Channel certifications for logistics agents", "Routing policy"],
    ...wp("§4.2"),
  },
  {
    id: "governance-cap",
    name: "GovernanceAgent",
    family: "capability",
    status: "beta",
    summary: "Voting rights, proposal thresholds and participation badges — the democratic layer of the mesh.",
    responsibilities: ["Voting weight per agent", "Participation badges", "Proposal thresholds"],
    ...wp("§4.2"),
    links: [{ label: "Governance", href: "/governance" }],
  },
  {
    id: "enforcer",
    name: "EnforcerAgent",
    family: "capability",
    status: "beta",
    summary: "Enforcement authority: legal holds, quarantine, dispute evaluation on on-chain evidence.",
    responsibilities: ["Flag / legal hold / quarantine", "Dispute evaluation with evidence", "Coordinates recalls with BrandAgent"],
    ...wp("§4.2"),
    links: [{ label: "Lifecycle card (flag / resolve)", href: "/assets" }, { label: "Resolve", href: "/resolve" }],
  },
  {
    id: "service",
    name: "ServiceAgent",
    family: "capability",
    status: "planned",
    summary: "The asset's maintenance ecosystem: every service event, repair, inspection and warranty claim.",
    responsibilities: ["Service and repair log per asset", "Warranty claims", "Replacement parts via SupplierAgents"],
    ...wp("§4.2"),
  },
  {
    id: "certification",
    name: "CertificationAgent",
    family: "capability",
    status: "planned",
    summary: "Tracks certifications per component and device: FDA 510(k), ISO 13485, CE, ISO 14001, cold chain.",
    responsibilities: ["Certification evidence records", "Composite badge validation", "Expiry monitoring"],
    ...wp("§4.3, §8"),
  },
  // ── Role agents (§3.2) ──────────────────────────────────────────────────
  {
    id: "manufacturer",
    name: "ManufacturerAgent",
    family: "role",
    status: "beta",
    summary: "Production, NFC binding and provenance establishment — the catalog → batch mint → binding station flow today.",
    responsibilities: ["Batch minting from templates", "Chip binding at the station", "Provenance establishment"],
    ...wp("§3.2"),
    links: [{ label: "Catalog", href: "/catalog" }, { label: "Binding Station", href: "/station" }],
  },
  {
    id: "seller",
    name: "SellerAgent",
    family: "role",
    status: "beta",
    summary: "Marketplace listing, price negotiation and deal execution; BOUND → ACTIVATED and custody transfers.",
    responsibilities: ["Listings and pricing", "Activate & list", "Settle to a buyer wallet"],
    ...wp("§3.2"),
    links: [{ label: "Assets", href: "/assets" }],
  },
  {
    id: "resale",
    name: "ResaleAgent",
    family: "role",
    status: "planned",
    summary: "Secondary-market resale of CLAIMED assets with owner-signed transfers and provenance continuity.",
    responsibilities: ["Owner-gated resale (transferAsset)", "Secondary listing", "Reputation-backed pricing"],
    ...wp("§3.2"),
  },
  {
    id: "customer",
    name: "CustomerAgent",
    family: "role",
    status: "beta",
    summary: "Purchase, ownership, disputes and warranty from the consumer side — the mobile app's Vault today.",
    responsibilities: ["Claim on purchase", "Ownership and transfer", "Disputes and warranty"],
    ...wp("§3.2"),
    links: [{ label: "Verify page", href: "https://verify.tagit.network" }],
  },
  {
    id: "recycling",
    name: "RecyclingAgent",
    family: "role",
    status: "beta",
    summary: "End-of-life routing, component recovery and the RECYCLED terminal state.",
    responsibilities: ["Recycle rail (lifecycle card)", "Component recovery routing", "Void & remint for destroyed chips"],
    ...wp("§3.2"),
    links: [{ label: "Lifecycle card (recycle)", href: "/assets" }],
  },
  // ── Logistics agents (§3.3) ─────────────────────────────────────────────
  {
    id: "carrier-ups",
    name: "CarrierAgent — UPS",
    family: "logistics",
    status: "beta",
    summary: "Accepts shipment proposals, confirms custody by NFC scan at pickup and delivery, updates transit state. Today: live tracking through the UPS Track API (needs UPS keys) and a demo carrier.",
    responsibilities: ["Shipment tracking → normalized timeline", "Custody proof at pickup / delivery (next)", "Competitive bidding on shipments (next)"],
    ...code("services/src/agents/logistics-agent.ts"),
    perPartner: true,
    panel: "logistics",
    skills: [{ id: "logistics__carriers", label: "List carriers", sample: {} }],
  },
  { id: "carrier-dhl", name: "CarrierAgent — DHL", family: "logistics", status: "planned", summary: "Same contract as the UPS agent, DHL Express tracking and bidding.", responsibilities: ["Tracking adapter", "Custody proofs", "Bidding"], ...wp("§3.3"), perPartner: true },
  { id: "carrier-fedex", name: "CarrierAgent — FedEx", family: "logistics", status: "planned", summary: "Same contract as the UPS agent, FedEx Track API.", responsibilities: ["Tracking adapter", "Custody proofs", "Bidding"], ...wp("§3.3"), perPartner: true },
  { id: "carrier-usps", name: "CarrierAgent — USPS", family: "logistics", status: "planned", summary: "USPS Tracking for domestic parcels.", responsibilities: ["Tracking adapter", "Custody proofs"], ...wp("§3.3"), perPartner: true },
  {
    id: "warehouse",
    name: "WarehouseAgent",
    family: "logistics",
    status: "planned",
    summary: "Per facility: accepts inbound transfers, NFC-scans every item, reports live inventory, negotiates outbound shipments, flags damage to RecoveryAgent.",
    responsibilities: ["Inbound NFC intake", "Live inventory state", "Cross-docking", "Damage / missing → RecoveryAgent"],
    ...wp("§3.3"),
    perPartner: true,
  },
  {
    id: "route",
    name: "RouteAgent",
    family: "logistics",
    status: "planned",
    summary: "Queries carriers for capacity and price, warehouses for availability, builds optimal multi-leg routes and reroutes on exceptions.",
    responsibilities: ["Carrier RFQ fan-out", "Multi-leg route construction", "Autonomous rerouting"],
    ...wp("§3.3"),
  },
  // ── Manufacturing agents (§3.4) ─────────────────────────────────────────
  { id: "bom", name: "BOMAgent", family: "manufacturing", status: "planned", summary: "Owns the bill of materials per product; triggers ProcurementAgent below reorder thresholds; reacts to schedule changes.", responsibilities: ["BOM ownership", "Reorder triggers", "Schedule reactions"], ...wp("§3.4") },
  { id: "procurement", name: "ProcurementAgent", family: "manufacturing", status: "planned", summary: "Broadcasts RFQs to SupplierAgents, evaluates bids on price, lead time, quality and compliance, issues purchase orders.", responsibilities: ["RFQ broadcast", "Bid evaluation", "PO issue + acknowledgment"], ...wp("§3.4") },
  { id: "supplier", name: "SupplierAgent", family: "manufacturing", status: "planned", summary: "Per supplier (tier 1–3): NFC-verified inventory, competitive bids, production scheduling for committed orders, live lead times.", responsibilities: ["Inventory reporting", "Bidding", "Lead-time updates"], ...wp("§3.4"), perPartner: true },
  { id: "inventory", name: "InventoryAgent", family: "manufacturing", status: "planned", summary: "Real-time NFC-verified stock levels across warehouses; answers BOM and procurement queries; predicts shortfalls.", responsibilities: ["Stock levels", "Availability queries", "Shortfall prediction"], ...wp("§3.4") },
  { id: "quality", name: "QualityAgent", family: "manufacturing", status: "planned", summary: "Inspection protocols on inbound components; blocks transitions on QC failure; triggers RecoveryAgent on defect patterns; certification verification.", responsibilities: ["Inspection protocols", "QC gate", "Defect-pattern escalation"], ...wp("§3.4") },
  { id: "scheduler", name: "ProductionSchedulerAgent", family: "manufacturing", status: "planned", summary: "Assembly timing from part ETAs; station scheduling; capacity across lines; real-time reoptimization on delays.", responsibilities: ["Assembly scheduling", "Capacity management", "Reoptimization"], ...wp("§3.4") },
  { id: "subassembly", name: "SubAssemblyAgent", family: "manufacturing", status: "planned", summary: "Composes components into sub-assemblies as composite NFTs that inherit provenance from every child.", responsibilities: ["Composite NFT creation", "Child ↔ parent links", "NFT tree management"], ...wp("§3.4, §8.2") },
  { id: "demand", name: "DemandForecastAgent", family: "manufacturing", status: "planned", summary: "Predicts production volumes from sales data; pre-negotiates supply agreements; manages buffer inventory.", responsibilities: ["Forecasting", "Long-term supply agreements", "Buffer inventory"], ...wp("§3.4") },
  // ── Growth & operations — running today ─────────────────────────────────
  {
    id: "sage",
    name: "Sage (mesh gateway)",
    family: "growth",
    status: "live",
    summary: "The A2A gateway utility agent: connectivity echo, agent identity, reputation and validation lookups.",
    responsibilities: ["Echo / connectivity", "Agent registry lookups", "Reputation + validation reads"],
    ...code("services/src/agents/sage-agent.ts"),
    links: [{ label: "AI Agents", href: "/agents" }],
    skills: [
      { id: "sage__echo", label: "Echo", sample: { message: "ping from the Agent Catalog" } },
      { id: "sage__check_reputation", label: "Reputation of agent 1", sample: { agentId: 1 } },
    ],
  },
  {
    id: "product",
    name: "Product agent",
    family: "growth",
    status: "live",
    summary: "Public product and price lookups for other agents and AI assistants (also exposed as MCP tools).",
    responsibilities: ["Get product by token id", "Get asset price"],
    ...code("services/src/agents/product-agent.ts"),
    skills: [
      { id: "tagit__get_product", label: "Product of token 56", sample: { tokenId: "56" } },
      { id: "tagit__get_asset_price", label: "Price of token 56", sample: { tokenId: "56" } },
    ],
  },
  {
    id: "anomaly",
    name: "Anomaly agent",
    family: "growth",
    status: "live",
    summary: "Rule-based fraud detection over NFC scans with five detectors (replay, velocity, geography, counter, pattern).",
    responsibilities: ["Scan anomaly analysis", "Signals for SecurityAgent and RecoveryAgent"],
    ...code("services/src/agents/anomaly-agent.ts"),
    skills: [{ id: "anomaly__analyze_scan", label: "Analyze a sample scan", sample: { tokenId: "56", uid: "04727F8AFF1890", counter: 1 } }],
  },
  {
    id: "bd",
    name: "BD agent (qualification + outreach)",
    family: "growth",
    status: "live",
    summary: "Scores and qualifies prospects, drafts pitches and runs approved outreach queues.",
    responsibilities: ["Lead scoring", "Pitch generation", "Outreach queue with approvals"],
    ...code("services/src/adagent"),
    links: [{ label: "BD Agent", href: "/adagent" }],
  },
  {
    id: "influencer",
    name: "Influencer agent",
    family: "growth",
    status: "live",
    summary: "Content engine with approval gateway, partnership amplifier and social-proof aggregation; kill switch included.",
    responsibilities: ["Content drafts", "Approval gateway", "Social proof aggregation"],
    ...code("services/src/influencer"),
    links: [{ label: "Influencer", href: "/influencer" }],
  },
  // ── Proposed — useful, not in the whitepaper ────────────────────────────
  { id: "compliance", name: "ComplianceAgent", family: "proposed", status: "proposed", summary: "Screens counterparties and components against OFAC / ITAR / export-control lists before deals and custody moves.", responsibilities: ["Sanctions screening", "Export-control checks", "Evidence records for SecurityAgent"], ...idea() },
  { id: "recall", name: "RecallAgent", family: "proposed", status: "proposed", summary: "Orchestrates a recall: identifies every affected asset from a component batch in seconds, notifies owners, tracks returns.", responsibilities: ["Affected-asset query", "Owner notification", "Return tracking"], ...idea() },
  { id: "carbon", name: "CarbonAgent", family: "proposed", status: "proposed", summary: "Carbon and sustainability accounting per provenance tree, from supplier declarations and logistics legs.", responsibilities: ["Per-asset carbon ledger", "Supplier declarations", "Reporting"], ...idea() },
  { id: "warranty", name: "WarrantyAgent", family: "proposed", status: "proposed", summary: "Warranty registration on claim, claim validation against the service log, automatic coverage decisions.", responsibilities: ["Auto-registration on claim", "Claim validation", "Coverage decisions"], ...idea() },
  { id: "insurance", name: "InsuranceAgent", family: "proposed", status: "proposed", summary: "Proof-backed insurance: custody and scan history as evidence for policies and claims.", responsibilities: ["Policy binding to assets", "Claim evidence packs"], ...idea() },
  { id: "customs", name: "CustomsAgent", family: "proposed", status: "proposed", summary: "Cross-border paperwork: HS codes, origin certificates and declarations generated from provenance data.", responsibilities: ["HS classification", "Origin certificates", "Declarations"], ...idea() },
  { id: "pricing", name: "PricingAgent", family: "proposed", status: "proposed", summary: "Dynamic list prices from demand, FX and channel; today's listing + FX rails are the foundation.", responsibilities: ["Price suggestions", "FX-aware display", "Channel rules"], ...idea(), links: [{ label: "Tokenomics", href: "/tokenomics" }] },
  { id: "marketplace", name: "MarketplaceAgent", family: "proposed", status: "proposed", summary: "Matches buyers and sellers for secondary sales with reputation-weighted offers.", responsibilities: ["Offer matching", "Escrow hand-off to TreasuryAgent"], ...idea() },
  { id: "support", name: "SupportAgent", family: "proposed", status: "proposed", summary: "Customer support with the asset's provenance in context: authenticity questions, transfers, warranty.", responsibilities: ["Provenance-aware answers", "Ticket escalation to EnforcerAgent"], ...idea() },
  { id: "notification", name: "NotificationAgent", family: "proposed", status: "proposed", summary: "Owner and brand alerts on state changes: bound, activated, flagged, resolved, transferred.", responsibilities: ["Event subscriptions", "Push / email delivery"], ...idea() },
  { id: "identity", name: "IdentityAgent", family: "proposed", status: "proposed", summary: "KYC / KYB for trust-tier promotion and DEFENSE_CLEARED eligibility, with evidence on IPFS.", responsibilities: ["Verification providers", "Tier evidence"], ...idea() },
  { id: "provisioning", name: "ChipProvisioningAgent", family: "proposed", status: "beta", summary: "Automates chip programming and binding at the station: program SDM, bind, activate & list — today's station flow as an agent.", responsibilities: ["Program SDM on blank chips", "Bind → anchor → activate → list"], ...idea(), links: [{ label: "Binding Station", href: "/station" }, { label: "Chip Tools", href: "/chip-tools" }] },
  { id: "analytics", name: "DataAgent", family: "proposed", status: "proposed", summary: "Reporting and analytics across the mesh: scans, sales, exceptions, per brand and per carrier.", responsibilities: ["Dashboards", "Scheduled reports"], ...idea(), links: [{ label: "Dashboard", href: "/dashboard" }] },
];

export interface CatalogFilters {
  family: AgentFamily | null;
  status: AgentStatus | null;
  q: string;
}

export function filterCatalog(agents: readonly CatalogAgent[], f: CatalogFilters): CatalogAgent[] {
  const q = f.q.trim().toLowerCase();
  return agents.filter((a) => {
    if (f.family && a.family !== f.family) return false;
    if (f.status && a.status !== f.status) return false;
    if (q && !`${a.name} ${a.summary} ${a.responsibilities.join(" ")}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

export function catalogSummary(agents: readonly CatalogAgent[]): Record<AgentStatus, number> & { total: number } {
  const out = { live: 0, beta: 0, planned: 0, proposed: 0, total: agents.length };
  for (const a of agents) out[a.status]++;
  return out;
}

/** Families in display order. */
export const FAMILY_ORDER: AgentFamily[] = ["growth", "logistics", "system", "capability", "role", "manufacturing", "proposed"];
