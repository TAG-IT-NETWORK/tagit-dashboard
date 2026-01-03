"use client";

export const dynamic = "force-dynamic";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
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
  ProposalStateBadge,
  VoteBar,
  CountdownTimer,
  AddressBadge,
} from "@tagit/ui";
import {
  ArrowLeft,
  Vote,
  Clock,
  CheckCircle,
  XCircle,
  Minus,
  Users,
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
  FileText,
  Code,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  mockProposals,
  generateMockVotes,
  calculateHouseVotes,
  type Proposal,
  type Vote as VoteType,
  type HouseVotes,
} from "@/lib/mocks/governance";

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

function getSupportLabel(support: 0 | 1 | 2): string {
  switch (support) {
    case 0:
      return "Against";
    case 1:
      return "For";
    case 2:
      return "Abstain";
  }
}

function getSupportColor(support: 0 | 1 | 2): string {
  switch (support) {
    case 0:
      return "text-red-500 bg-red-500/10";
    case 1:
      return "text-green-500 bg-green-500/10";
    case 2:
      return "text-gray-500 bg-gray-500/10";
  }
}

function getHouseDisplayName(house: string): string {
  switch (house) {
    case "token":
      return "Token House";
    case "brand":
      return "Brand House";
    case "technical":
      return "Technical House";
    default:
      return house;
  }
}

function getHouseColor(house: string): string {
  switch (house) {
    case "token":
      return "bg-blue-500";
    case "brand":
      return "bg-purple-500";
    case "technical":
      return "bg-orange-500";
    default:
      return "bg-gray-500";
  }
}

interface VotingPanelProps {
  proposal: Proposal;
  onVote: (support: 0 | 1 | 2) => void;
}

function VotingPanel({ proposal, onVote }: VotingPanelProps) {
  const [selectedVote, setSelectedVote] = useState<0 | 1 | 2 | null>(null);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isActive = proposal.state === "ACTIVE";
  const canVote = isActive && proposal.endTime > Date.now();

  const handleSubmitVote = async () => {
    if (selectedVote === null) return;
    setIsSubmitting(true);
    // Simulate vote submission
    await new Promise((resolve) => setTimeout(resolve, 1000));
    onVote(selectedVote);
    setIsSubmitting(false);
  };

  if (!canVote) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Voting</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Vote className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              {proposal.state === "ACTIVE"
                ? "Voting period has ended"
                : `This proposal is ${proposal.state.toLowerCase()}`}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Vote className="h-5 w-5" />
          Cast Your Vote
        </CardTitle>
        <CardDescription>
          <CountdownTimer endTime={proposal.endTime} showIcon /> remaining
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Vote Options */}
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant={selectedVote === 1 ? "default" : "outline"}
            className={selectedVote === 1 ? "bg-green-600 hover:bg-green-700" : ""}
            onClick={() => setSelectedVote(1)}
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            For
          </Button>
          <Button
            variant={selectedVote === 0 ? "default" : "outline"}
            className={selectedVote === 0 ? "bg-red-600 hover:bg-red-700" : ""}
            onClick={() => setSelectedVote(0)}
          >
            <XCircle className="h-4 w-4 mr-2" />
            Against
          </Button>
          <Button
            variant={selectedVote === 2 ? "default" : "outline"}
            className={selectedVote === 2 ? "bg-gray-600 hover:bg-gray-700" : ""}
            onClick={() => setSelectedVote(2)}
          >
            <Minus className="h-4 w-4 mr-2" />
            Abstain
          </Button>
        </div>

        {/* Reason (optional) */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Reason (optional)</label>
          <Input
            placeholder="Add a comment to your vote..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        {/* Submit Button */}
        <Button
          className="w-full"
          disabled={selectedVote === null || isSubmitting}
          onClick={handleSubmitVote}
        >
          {isSubmitting ? "Submitting..." : "Submit Vote"}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Your vote will be recorded on-chain and cannot be changed.
        </p>
      </CardContent>
    </Card>
  );
}

interface HouseBreakdownProps {
  houseVotes: HouseVotes[];
}

function HouseBreakdown({ houseVotes }: HouseBreakdownProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">House Breakdown</CardTitle>
        <CardDescription>Vote distribution across governance houses</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {houseVotes.map((house) => {
          const total = house.forVotes + house.againstVotes + house.abstainVotes;
          return (
            <div key={house.house} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${getHouseColor(house.house)}`} />
                  <span className="font-medium">{getHouseDisplayName(house.house)}</span>
                </div>
                <div className="flex items-center gap-2">
                  {house.quorumReached ? (
                    <Badge variant="outline" className="text-green-500 border-green-500/50">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Quorum
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-yellow-500 border-yellow-500/50">
                      <Clock className="h-3 w-3 mr-1" />
                      {house.quorum - total} needed
                    </Badge>
                  )}
                </div>
              </div>
              <VoteBar
                forVotes={house.forVotes}
                againstVotes={house.againstVotes}
                abstainVotes={house.abstainVotes}
                quorum={house.quorum}
                showLabels
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

interface VoteListProps {
  votes: VoteType[];
}

function VoteList({ votes }: VoteListProps) {
  const [showAll, setShowAll] = useState(false);
  const displayedVotes = showAll ? votes : votes.slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5" />
          Recent Votes
          <Badge variant="secondary">{votes.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {displayedVotes.map((vote, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <Badge className={getSupportColor(vote.support)} variant="outline">
                  {getSupportLabel(vote.support)}
                </Badge>
                <AddressBadge address={vote.voter} showCopy={false} showEtherscan={false} />
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Badge variant="outline" className="text-xs">
                  {getHouseDisplayName(vote.house)}
                </Badge>
                <span className="font-mono">{vote.weight.toLocaleString()}</span>
                <span className="text-muted-foreground">
                  {formatRelativeTime(vote.timestamp)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {votes.length > 5 && (
          <Button
            variant="ghost"
            className="w-full mt-4"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? (
              <>
                <ChevronUp className="h-4 w-4 mr-2" />
                Show Less
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-2" />
                Show All ({votes.length} votes)
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

interface ExecutionDetailsProps {
  proposal: Proposal;
}

function ExecutionDetails({ proposal }: ExecutionDetailsProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Code className="h-5 w-5" />
          Execution Details
        </CardTitle>
        <CardDescription>
          Technical details about what this proposal will execute
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {proposal.targets.map((target, idx) => (
          <div key={idx} className="p-4 rounded-lg border bg-muted/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Action {idx + 1}</span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Target</span>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                    {target.slice(0, 10)}...{target.slice(-8)}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => copyToClipboard(target, `target-${idx}`)}
                  >
                    {copied === `target-${idx}` ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Value</span>
                <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                  {proposal.values[idx]} wei
                </code>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Calldata</span>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                    {proposal.calldatas[idx].slice(0, 16)}...
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => copyToClipboard(proposal.calldatas[idx], `calldata-${idx}`)}
                  >
                    {copied === `calldata-${idx}` ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function ProposalDetailPage() {
  const params = useParams();
  const proposalId = params.id as string;

  // Find proposal from mock data
  const proposal = mockProposals.find((p) => p.id === proposalId);

  // Generate mock votes for this proposal
  const votes = useMemo(() => {
    if (!proposal) return [];
    return generateMockVotes(proposal.id);
  }, [proposal]);

  // Calculate house votes
  const houseVotes = useMemo(() => {
    return calculateHouseVotes(votes);
  }, [votes]);

  const handleVote = (support: 0 | 1 | 2) => {
    console.log("Vote submitted:", support);
    // In real implementation, this would call the governance contract
  };

  if (!proposal) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <FileText className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Proposal Not Found</h1>
        <p className="text-muted-foreground">
          The proposal you're looking for doesn't exist or has been removed.
        </p>
        <Link href="/governance">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Governance
          </Button>
        </Link>
      </div>
    );
  }

  const totalVotes = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
  const quorumReached = totalVotes >= proposal.quorum;

  return (
    <div className="space-y-6">
      {/* Back Navigation */}
      <Link
        href="/governance"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Governance
      </Link>

      {/* Proposal Header */}
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ProposalStateBadge state={proposal.state} showIcon />
              <Badge variant="outline" className="capitalize">
                {proposal.category}
              </Badge>
            </div>
            <h1 className="text-2xl font-bold">{proposal.title}</h1>
          </div>
          <span className="text-lg text-muted-foreground">#{proposal.id}</span>
        </div>

        {/* Proposer & Timing */}
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Proposed by</span>
            <AddressBadge address={proposal.proposer} />
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            Created {formatDate(proposal.createdAt)}
          </div>
          {proposal.executedAt && (
            <div className="flex items-center gap-2 text-green-500">
              <CheckCircle className="h-4 w-4" />
              Executed {formatDate(proposal.executedAt)}
            </div>
          )}
        </div>
      </div>

      {/* Demo Mode Indicator */}
      <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
        <AlertTriangle className="h-4 w-4 text-yellow-600" />
        <span className="text-sm text-yellow-600">
          Demo Mode: Using mock data. Connect to deployed contracts for live governance.
        </span>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Vote Results Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Vote Results</CardTitle>
              <CardDescription>
                {totalVotes.toLocaleString()} total votes •{" "}
                {quorumReached ? "Quorum reached" : `${(proposal.quorum - totalVotes).toLocaleString()} more needed for quorum`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <VoteBar
                forVotes={proposal.forVotes}
                againstVotes={proposal.againstVotes}
                abstainVotes={proposal.abstainVotes}
                quorum={proposal.quorum}
                showLabels
                showQuorum
              />

              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-green-500/10 text-center">
                  <p className="text-2xl font-bold text-green-500">
                    {proposal.forVotes.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">For</p>
                </div>
                <div className="p-4 rounded-lg bg-red-500/10 text-center">
                  <p className="text-2xl font-bold text-red-500">
                    {proposal.againstVotes.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">Against</p>
                </div>
                <div className="p-4 rounded-lg bg-gray-500/10 text-center">
                  <p className="text-2xl font-bold text-gray-500">
                    {proposal.abstainVotes.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">Abstain</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                  {proposal.description}
                </pre>
              </div>
            </CardContent>
          </Card>

          {/* House Breakdown */}
          <HouseBreakdown houseVotes={houseVotes} />

          {/* Vote List */}
          <VoteList votes={votes} />

          {/* Execution Details */}
          <ExecutionDetails proposal={proposal} />
        </div>

        {/* Right Column - Voting & Info */}
        <div className="space-y-6">
          {/* Voting Panel */}
          <VotingPanel proposal={proposal} onVote={handleVote} />

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <div>
                    <p className="text-sm font-medium">Created</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(proposal.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <div>
                    <p className="text-sm font-medium">Voting Started</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(proposal.startTime)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      proposal.endTime < Date.now() ? "bg-gray-500" : "bg-yellow-500"
                    }`}
                  />
                  <div>
                    <p className="text-sm font-medium">Voting Ends</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(proposal.endTime)}
                    </p>
                  </div>
                </div>
                {proposal.executedAt && (
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <div>
                      <p className="text-sm font-medium">Executed</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(proposal.executedAt)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {proposal.state === "SUCCEEDED" && (
                <Button className="w-full" variant="default">
                  Queue Proposal
                </Button>
              )}
              {proposal.state === "QUEUED" && (
                <Button className="w-full" variant="default">
                  Execute Proposal
                </Button>
              )}
              <Button className="w-full" variant="outline">
                <ExternalLink className="h-4 w-4 mr-2" />
                View on Etherscan
              </Button>
              <Button className="w-full" variant="outline">
                <Copy className="h-4 w-4 mr-2" />
                Share Proposal
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
