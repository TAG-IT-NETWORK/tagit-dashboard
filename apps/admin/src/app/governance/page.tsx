"use client";

export const dynamic = "force-dynamic";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePublicClient, useChainId } from "wagmi";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Badge,
  Input,
  MetricCard,
  ProposalStateBadge,
  VoteBar,
  CountdownTimer,
  AddressBadge,
  type ProposalState,
} from "@tagit/ui";
import {
  Search,
  Filter,
  Plus,
  Vote,
  Users,
  CheckCircle,
  Clock,
  FileText,
  TrendingUp,
  Loader2,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

// ── TAGITGovernor addresses by chain ──

const GOVERNOR_ADDRESSES: Record<number, `0x${string}`> = {
  84532: "0xCF67DF870EccBB7838c3ab7876467c89d84dce89", // Base Sepolia
  11155420: "0x8A7cd4FC493663Fc5CD0268704969D644BA773e3", // OP Sepolia
  421614: "0xad0b3009b5C57D3034bB4b8eBaCb1028D6891c06", // Arbitrum Sepolia
};

// ── Minimal ABI — OZ GovernorUpgradeable view functions ──

const GOVERNOR_ABI = [
  {
    name: "proposalCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "state",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "proposalId", type: "uint256" }],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "proposalVotes",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "proposalId", type: "uint256" }],
    outputs: [
      { name: "againstVotes", type: "uint256" },
      { name: "forVotes", type: "uint256" },
      { name: "abstainVotes", type: "uint256" },
    ],
  },
  {
    name: "proposalProposer",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "proposalId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "proposalDeadline",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "proposalId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "proposalSnapshot",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "proposalId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// ── OZ ProposalState enum → UI ProposalState ──

const OZ_STATE_MAP: Record<number, ProposalState> = {
  0: "PENDING",
  1: "ACTIVE",
  2: "CANCELED",
  3: "DEFEATED",
  4: "SUCCEEDED",
  5: "QUEUED",
  6: "EXPIRED",
  7: "EXECUTED",
};

// ── Types ──

interface OnChainProposal {
  id: string; // proposalId as decimal string
  idBigInt: bigint;
  proposer: string;
  state: ProposalState;
  forVotes: number;
  againstVotes: number;
  abstainVotes: number;
  snapshotBlock: number;
  deadlineBlock: number;
}

// ── Filters ──

const stateFilters: { value: ProposalState | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "ACTIVE", label: "Active" },
  { value: "PENDING", label: "Pending" },
  { value: "SUCCEEDED", label: "Succeeded" },
  { value: "QUEUED", label: "Queued" },
  { value: "EXECUTED", label: "Executed" },
  { value: "DEFEATED", label: "Defeated" },
];

// ── Helpers ──

function formatVotes(raw: number): string {
  if (raw === 0) return "0";
  // Governor votes are in token decimals (18). Divide to get readable units.
  const units = raw / 1e18;
  if (units >= 1_000_000) return `${(units / 1_000_000).toFixed(1)}M`;
  if (units >= 1_000) return `${(units / 1_000).toFixed(1)}K`;
  return units.toFixed(2);
}

// Approximate block number → timestamp (12s/block average across testnets)
const BLOCK_TIME_MS = 12_000;

function blockToTimestampMs(block: number, currentBlock: number): number {
  const delta = block - currentBlock;
  return Date.now() + delta * BLOCK_TIME_MS;
}

function formatRelativeBlock(block: number, currentBlock: number): string {
  const delta = block - currentBlock;
  const absDelta = Math.abs(delta);
  const isPast = delta < 0;

  const seconds = Math.floor((absDelta * BLOCK_TIME_MS) / 1000);
  if (seconds < 60) return isPast ? `${seconds}s ago` : `in ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return isPast ? `${minutes}m ago` : `in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return isPast ? `${hours}h ago` : `in ${hours}h`;
  const days = Math.floor(hours / 24);
  return isPast ? `${days}d ago` : `in ${days}d`;
}

// ── ProposalCard ──

interface ProposalCardProps {
  proposal: OnChainProposal;
  currentBlock: number;
  chainId: number;
}

function ProposalCard({ proposal, currentBlock, chainId }: ProposalCardProps) {
  const totalVotesRaw = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
  const isActive = proposal.state === "ACTIVE";
  const deadlineMs = blockToTimestampMs(proposal.deadlineBlock, currentBlock);

  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <ProposalStateBadge state={proposal.state} />
            <Link href={`/governance/${proposal.id}`}>
              <CardTitle className="text-lg hover:text-primary transition-colors cursor-pointer">
                Proposal #{proposal.id}
              </CardTitle>
            </Link>
          </div>
          <span className="text-sm text-muted-foreground whitespace-nowrap font-mono">
            #{proposal.id}
          </span>
        </div>
        <CardDescription>
          Block {proposal.snapshotBlock.toLocaleString()} →{" "}
          {proposal.deadlineBlock.toLocaleString()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Vote Progress */}
        <div className="space-y-2">
          <VoteBar
            forVotes={proposal.forVotes}
            againstVotes={proposal.againstVotes}
            abstainVotes={proposal.abstainVotes}
            showLabels
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{formatVotes(totalVotesRaw)} votes total</span>
            {isActive && deadlineMs > Date.now() && (
              <CountdownTimer endTime={deadlineMs} showIcon />
            )}
          </div>
        </div>

        {/* Vote breakdown */}
        <div className="grid grid-cols-3 gap-2 text-xs text-center">
          <div className="rounded bg-green-500/10 px-2 py-1.5">
            <p className="font-semibold text-green-500">{formatVotes(proposal.forVotes)}</p>
            <p className="text-muted-foreground">For</p>
          </div>
          <div className="rounded bg-red-500/10 px-2 py-1.5">
            <p className="font-semibold text-red-500">{formatVotes(proposal.againstVotes)}</p>
            <p className="text-muted-foreground">Against</p>
          </div>
          <div className="rounded bg-gray-500/10 px-2 py-1.5">
            <p className="font-semibold text-muted-foreground">
              {formatVotes(proposal.abstainVotes)}
            </p>
            <p className="text-muted-foreground">Abstain</p>
          </div>
        </div>

        {/* Proposer & Timing */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Proposed by</span>
            <AddressBadge
              address={proposal.proposer}
              chainId={chainId}
              showCopy={false}
              showEtherscan={false}
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {isActive
              ? `Ends ${formatRelativeBlock(proposal.deadlineBlock, currentBlock)}`
              : `Deadline block ${proposal.deadlineBlock.toLocaleString()}`}
          </span>
        </div>

        {/* Action Button */}
        <Link href={`/governance/${proposal.id}`}>
          <Button variant="outline" className="w-full">
            {isActive ? "Vote Now" : "View Details"}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

// ── Page ──

export default function GovernancePage() {
  const chainId = useChainId();
  const client = usePublicClient();

  const [proposals, setProposals] = useState<OnChainProposal[]>([]);
  const [currentBlock, setCurrentBlock] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [stateFilter, setStateFilter] = useState<ProposalState | "ALL">("ALL");

  const governorAddress = GOVERNOR_ADDRESSES[chainId];

  const fetchProposals = useCallback(async () => {
    if (!client) {
      setError("No public client available");
      setLoading(false);
      return;
    }
    if (!governorAddress) {
      setError(`No TAGITGovernor contract configured for chain ${chainId}`);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [rawCount, blockNumber] = await Promise.all([
        client.readContract({
          address: governorAddress,
          abi: GOVERNOR_ABI,
          functionName: "proposalCount",
        }),
        client.getBlockNumber(),
      ]);

      const count = Number(rawCount);
      const block = Number(blockNumber);
      setCurrentBlock(block);

      if (count === 0) {
        setProposals([]);
        setLoading(false);
        return;
      }

      // Fetch all proposals in parallel. Proposal IDs in OZ Governor are
      // proposal hashes (uint256), not sequential ints. However TAGITGovernor
      // exposes proposalCount() so we assume sequential IDs starting at 1.
      const ids = Array.from({ length: count }, (_, i) => BigInt(i + 1));

      const results = await Promise.all(
        ids.map(async (id) => {
          const [ozState, votes, proposer, deadline, snapshot] = await Promise.all([
            client
              .readContract({
                address: governorAddress,
                abi: GOVERNOR_ABI,
                functionName: "state",
                args: [id],
              })
              .catch(() => 0 as number),
            client
              .readContract({
                address: governorAddress,
                abi: GOVERNOR_ABI,
                functionName: "proposalVotes",
                args: [id],
              })
              .catch(() => [0n, 0n, 0n] as const),
            client
              .readContract({
                address: governorAddress,
                abi: GOVERNOR_ABI,
                functionName: "proposalProposer",
                args: [id],
              })
              .catch(() => "0x0000000000000000000000000000000000000000" as `0x${string}`),
            client
              .readContract({
                address: governorAddress,
                abi: GOVERNOR_ABI,
                functionName: "proposalDeadline",
                args: [id],
              })
              .catch(() => 0n),
            client
              .readContract({
                address: governorAddress,
                abi: GOVERNOR_ABI,
                functionName: "proposalSnapshot",
                args: [id],
              })
              .catch(() => 0n),
          ]);

          const stateNum = typeof ozState === "number" ? ozState : Number(ozState);
          const [againstRaw, forRaw, abstainRaw] = votes as [bigint, bigint, bigint];

          return {
            id: id.toString(),
            idBigInt: id,
            proposer: proposer as string,
            state: OZ_STATE_MAP[stateNum] ?? "PENDING",
            forVotes: Number(forRaw),
            againstVotes: Number(againstRaw),
            abstainVotes: Number(abstainRaw),
            snapshotBlock: Number(snapshot),
            deadlineBlock: Number(deadline),
          } satisfies OnChainProposal;
        }),
      );

      setProposals(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch proposals");
    } finally {
      setLoading(false);
    }
  }, [client, governorAddress, chainId]);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  // ── Derived stats ──

  const activeCount = proposals.filter((p) => p.state === "ACTIVE").length;

  // ── Filtered list ──

  const filteredProposals = useMemo(() => {
    return proposals.filter((p) => {
      const matchesSearch =
        p.id.includes(searchQuery) || p.proposer.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesState = stateFilter === "ALL" || p.state === stateFilter;
      return matchesSearch && matchesState;
    });
  }, [proposals, searchQuery, stateFilter]);

  const activeProposals = filteredProposals.filter((p) => p.state === "ACTIVE");
  const otherProposals = filteredProposals.filter((p) => p.state !== "ACTIVE");

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Vote className="h-6 w-6 text-primary" />
            Governance
          </h1>
          <p className="text-muted-foreground">Live on-chain proposals from TAGITGovernor</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchProposals} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Link href="/governance/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Proposal
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Active Proposals"
          value={loading ? "—" : activeCount}
          icon={<Clock className="h-5 w-5" />}
          className={activeCount > 0 ? "border-green-500/50" : ""}
        />
        <MetricCard
          title="Total Proposals"
          value={loading ? "—" : proposals.length}
          icon={<FileText className="h-5 w-5" />}
        />
        <MetricCard
          title="Current Block"
          value={loading || currentBlock === 0 ? "—" : currentBlock.toLocaleString()}
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <MetricCard
          title="Network"
          value={
            chainId === 84532
              ? "Base Sepolia"
              : chainId === 11155420
                ? "OP Sepolia"
                : chainId === 421614
                  ? "Arb Sepolia"
                  : `Chain ${chainId}`
          }
          icon={<Users className="h-5 w-5" />}
        />
      </div>

      {/* Chain / Contract info bar */}
      <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
        <CheckCircle className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm text-muted-foreground">
          Reading from{" "}
          <span className="font-mono text-foreground">
            {governorAddress ?? "no contract for this chain"}
          </span>
          {currentBlock > 0 && <span> &middot; block {currentBlock.toLocaleString()}</span>}
        </span>
      </div>

      {/* Error */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Filters — shown only when we have data */}
      {!loading && proposals.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by proposal ID or proposer address..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* State Filter */}
              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="h-4 w-4 text-muted-foreground" />
                {stateFilters.map((filter) => (
                  <Badge
                    key={filter.value}
                    variant={stateFilter === filter.value ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setStateFilter(filter.value)}
                  >
                    {filter.label}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Proposals Section */}
      {!loading && activeProposals.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5 text-green-500" />
            Active Proposals
            <Badge variant="secondary">{activeProposals.length}</Badge>
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {activeProposals.map((proposal) => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                currentBlock={currentBlock}
                chainId={chainId}
              />
            ))}
          </div>
        </div>
      )}

      {/* Other Proposals Section */}
      {!loading && otherProposals.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            {stateFilter === "ALL" ? "Past & Pending Proposals" : `${stateFilter} Proposals`}
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {otherProposals.map((proposal) => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                currentBlock={currentBlock}
                chainId={chainId}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State — no proposals on-chain */}
      {!loading && !error && proposals.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Vote className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No proposals on-chain yet</h3>
            <p className="text-muted-foreground mb-4">
              TAGITGovernor has no proposals on{" "}
              {chainId === 84532
                ? "Base Sepolia"
                : chainId === 11155420
                  ? "OP Sepolia"
                  : chainId === 421614
                    ? "Arbitrum Sepolia"
                    : `chain ${chainId}`}
              . Be the first to submit one.
            </p>
            <Link href="/governance/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Proposal
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Filtered empty state */}
      {!loading && !error && proposals.length > 0 && filteredProposals.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No proposals match your filters</h3>
            <p className="text-muted-foreground mb-4">Try adjusting your search or state filter.</p>
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery("");
                setStateFilter("ALL");
              }}
            >
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
