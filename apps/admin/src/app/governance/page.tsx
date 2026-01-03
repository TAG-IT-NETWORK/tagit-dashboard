"use client";

export const dynamic = "force-dynamic";

import { useState, useMemo } from "react";
import Link from "next/link";
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
  AlertTriangle,
} from "lucide-react";
import {
  mockProposals,
  getGovernanceStats,
  type Proposal,
} from "@/lib/mocks/governance";

const stateFilters: { value: ProposalState | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "ACTIVE", label: "Active" },
  { value: "PENDING", label: "Pending" },
  { value: "SUCCEEDED", label: "Succeeded" },
  { value: "QUEUED", label: "Queued" },
  { value: "EXECUTED", label: "Executed" },
  { value: "DEFEATED", label: "Defeated" },
];

const categoryFilters: { value: string; label: string }[] = [
  { value: "ALL", label: "All Categories" },
  { value: "protocol", label: "Protocol" },
  { value: "parameter", label: "Parameter" },
  { value: "treasury", label: "Treasury" },
  { value: "other", label: "Other" },
];

function getCategoryIcon(category: string) {
  switch (category) {
    case "protocol":
      return <FileText className="h-4 w-4" />;
    case "parameter":
      return <TrendingUp className="h-4 w-4" />;
    case "treasury":
      return <Vote className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
}

function getCategoryColor(category: string): string {
  switch (category) {
    case "protocol":
      return "bg-purple-500/10 text-purple-500 border-purple-500/20";
    case "parameter":
      return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    case "treasury":
      return "bg-green-500/10 text-green-500 border-green-500/20";
    default:
      return "bg-gray-500/10 text-gray-500 border-gray-500/20";
  }
}

function formatRelativeTime(timestamp: number): string {
  const diff = timestamp - Date.now();
  const absDiff = Math.abs(diff);
  const isPast = diff < 0;

  const seconds = Math.floor(absDiff / 1000);
  if (seconds < 60) return isPast ? `${seconds}s ago` : `in ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return isPast ? `${minutes}m ago` : `in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return isPast ? `${hours}h ago` : `in ${hours}h`;
  const days = Math.floor(hours / 24);
  return isPast ? `${days}d ago` : `in ${days}d`;
}

interface ProposalCardProps {
  proposal: Proposal;
}

function ProposalCard({ proposal }: ProposalCardProps) {
  const totalVotes = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
  const quorumReached = totalVotes >= proposal.quorum;
  const isActive = proposal.state === "ACTIVE";

  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={getCategoryColor(proposal.category)}>
                {getCategoryIcon(proposal.category)}
                <span className="ml-1 capitalize">{proposal.category}</span>
              </Badge>
              <ProposalStateBadge state={proposal.state} />
            </div>
            <Link href={`/governance/${proposal.id}`}>
              <CardTitle className="text-lg hover:text-primary transition-colors cursor-pointer">
                {proposal.title}
              </CardTitle>
            </Link>
          </div>
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            #{proposal.id}
          </span>
        </div>
        <CardDescription className="line-clamp-2">
          {proposal.description.split("\n")[0].replace(/^##\s*Summary\s*/i, "")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Vote Progress */}
        <div className="space-y-2">
          <VoteBar
            forVotes={proposal.forVotes}
            againstVotes={proposal.againstVotes}
            abstainVotes={proposal.abstainVotes}
            quorum={proposal.quorum}
            showLabels
            showQuorum
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {totalVotes.toLocaleString()} votes • {quorumReached ? "Quorum reached" : `${proposal.quorum.toLocaleString()} needed`}
            </span>
            {isActive && proposal.endTime > Date.now() && (
              <CountdownTimer endTime={proposal.endTime} showIcon />
            )}
          </div>
        </div>

        {/* Proposer & Timing */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Proposed by</span>
            <AddressBadge
              address={proposal.proposer}
              showCopy={false}
              showEtherscan={false}
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {isActive
              ? `Ends ${formatRelativeTime(proposal.endTime)}`
              : formatRelativeTime(proposal.createdAt)}
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

export default function GovernancePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [stateFilter, setStateFilter] = useState<ProposalState | "ALL">("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  const stats = getGovernanceStats();

  const filteredProposals = useMemo(() => {
    return mockProposals.filter((proposal) => {
      const matchesSearch =
        proposal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        proposal.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        proposal.id.includes(searchQuery);
      const matchesState = stateFilter === "ALL" || proposal.state === stateFilter;
      const matchesCategory =
        categoryFilter === "ALL" || proposal.category === categoryFilter;
      return matchesSearch && matchesState && matchesCategory;
    });
  }, [searchQuery, stateFilter, categoryFilter]);

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
          <p className="text-muted-foreground">
            Participate in protocol governance through proposals and voting
          </p>
        </div>
        <Link href="/governance/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Proposal
          </Button>
        </Link>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Active Proposals"
          value={stats.activeProposals}
          icon={<Clock className="h-5 w-5" />}
          className={stats.activeProposals > 0 ? "border-green-500/50" : ""}
        />
        <MetricCard
          title="Total Proposals"
          value={stats.totalProposals}
          icon={<FileText className="h-5 w-5" />}
        />
        <MetricCard
          title="Participation Rate"
          value={`${Math.round(stats.participationRate * 100)}%`}
          icon={<Users className="h-5 w-5" />}
        />
        <MetricCard
          title="Quorum Threshold"
          value={stats.quorumThreshold.toLocaleString()}
          icon={<CheckCircle className="h-5 w-5" />}
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search proposals by title, description, or ID..."
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

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 rounded-md border bg-background text-sm"
            >
              {categoryFilters.map((filter) => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Demo Mode Indicator */}
      <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
        <AlertTriangle className="h-4 w-4 text-yellow-600" />
        <span className="text-sm text-yellow-600">
          Demo Mode: Using mock data. Connect to deployed contracts for live governance.
        </span>
      </div>

      {/* Active Proposals Section */}
      {activeProposals.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5 text-green-500" />
            Active Proposals
            <Badge variant="secondary">{activeProposals.length}</Badge>
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {activeProposals.map((proposal) => (
              <ProposalCard key={proposal.id} proposal={proposal} />
            ))}
          </div>
        </div>
      )}

      {/* Other Proposals Section */}
      {otherProposals.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            {stateFilter === "ALL" ? "Past & Pending Proposals" : `${stateFilter} Proposals`}
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {otherProposals.map((proposal) => (
              <ProposalCard key={proposal.id} proposal={proposal} />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredProposals.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Vote className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No proposals found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || stateFilter !== "ALL" || categoryFilter !== "ALL"
                ? "Try adjusting your filters"
                : "Be the first to create a proposal"}
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
    </div>
  );
}
