"use client";

import { useState, useEffect, useCallback } from "react";
import { usePublicClient, useChainId, useAccount } from "wagmi";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  MetricCard,
  useToast,
} from "@tagit/ui";
import {
  useGiveFeedback,
  getAgentContractsForChain,
  TAGITAgentReputationABI,
  type Feedback,
} from "@tagit/contracts";
import { TransactionStatus } from "../transaction-status";
import { StarRating } from "./star-rating";
import { FeedbackCard } from "./feedback-card";
import { Star, MessageSquare, Loader2, AlertCircle, RefreshCw } from "lucide-react";

interface ReputationSummaryData {
  totalFeedback: bigint;
  activeFeedback: bigint;
  averageRating: bigint;
  weightedScore: bigint;
  lastFeedbackAt: bigint;
}

interface FeedbackWithId {
  feedback: Feedback;
  feedbackId: bigint;
}

interface AgentReputationTabProps {
  agentId: number;
  registrant: string;
}

export function AgentReputationTab({ agentId, registrant }: AgentReputationTabProps) {
  const chainId = useChainId();
  const client = usePublicClient();
  const { address: connectedWallet } = useAccount();
  const { toast } = useToast();

  // ── On-chain data state ──
  const [summary, setSummary] = useState<ReputationSummaryData | null>(null);
  const [feedbackItems, setFeedbackItems] = useState<FeedbackWithId[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Give feedback form state ──
  const [newRating, setNewRating] = useState(0);
  const [newComment, setNewComment] = useState("");
  const [showRevokedItems, setShowRevokedItems] = useState(false);

  // ── Write hook ──
  const {
    giveFeedback,
    hash: giveHash,
    isPending: giveIsPending,
    isConfirming: giveIsConfirming,
    isSuccess: giveIsSuccess,
    error: giveError,
  } = useGiveFeedback();

  // ── Fetch on-chain data ──
  const fetchData = useCallback(async () => {
    if (!client || isNaN(agentId) || agentId < 1) return;

    let contracts;
    try {
      contracts = getAgentContractsForChain(chainId);
    } catch {
      setLoadError(`No agent contracts configured for chain ${chainId}`);
      setLoadingData(false);
      return;
    }

    setLoadingData(true);
    setLoadError(null);

    try {
      const id = BigInt(agentId);

      const [rawSummary, rawFeedbackList, rawIds] = await Promise.all([
        client.readContract({
          address: contracts.TAGITAgentReputation,
          abi: TAGITAgentReputationABI,
          functionName: "getSummary",
          args: [id],
        }),
        client.readContract({
          address: contracts.TAGITAgentReputation,
          abi: TAGITAgentReputationABI,
          functionName: "readAllFeedback",
          args: [id],
        }),
        client.readContract({
          address: contracts.TAGITAgentReputation,
          abi: TAGITAgentReputationABI,
          functionName: "getAgentFeedbackIds",
          args: [id],
        }),
      ]);

      const summaryTuple = rawSummary as {
        totalFeedback: bigint;
        activeFeedback: bigint;
        averageRating: bigint;
        weightedScore: bigint;
        lastFeedbackAt: bigint;
      };

      setSummary({
        totalFeedback: summaryTuple.totalFeedback,
        activeFeedback: summaryTuple.activeFeedback,
        averageRating: summaryTuple.averageRating,
        weightedScore: summaryTuple.weightedScore,
        lastFeedbackAt: summaryTuple.lastFeedbackAt,
      });

      const feedbackList = rawFeedbackList as readonly Feedback[];
      const idList = rawIds as readonly bigint[];

      const items: FeedbackWithId[] = feedbackList.map((fb, i) => ({
        feedback: fb,
        feedbackId: idList[i] ?? BigInt(i),
      }));

      setFeedbackItems(items);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load reputation data");
    } finally {
      setLoadingData(false);
    }
  }, [client, chainId, agentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refresh after successful feedback submission
  useEffect(() => {
    if (giveIsSuccess) {
      toast({ title: "Feedback submitted", variant: "success" });
      setNewRating(0);
      setNewComment("");
      // Slight delay to allow chain state to propagate
      const timer = setTimeout(() => fetchData(), 3000);
      return () => clearTimeout(timer);
    }
  }, [giveIsSuccess, toast, fetchData]);

  // ── Derived values ──
  const averageRating = summary ? Number(summary.averageRating) / 100 : 0;
  const weightedScore = summary ? Number(summary.weightedScore) / 100 : 0;
  const isRegistrant =
    !!connectedWallet && connectedWallet.toLowerCase() === registrant.toLowerCase();

  const visibleItems = showRevokedItems
    ? feedbackItems
    : feedbackItems.filter((item) => !item.feedback.revoked);

  // ── Loading skeleton ──
  if (loadingData) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-4 w-20 animate-pulse bg-muted rounded mb-3" />
                <div className="h-8 w-12 animate-pulse bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (loadError) {
    return (
      <Card className="border-destructive">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <p className="text-sm">{loadError}</p>
            </div>
            <Button size="sm" variant="outline" onClick={fetchData}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Summary stats ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard
          title="Total Feedback"
          value={summary ? Number(summary.totalFeedback) : 0}
          icon={<MessageSquare className="h-5 w-5" />}
        />
        <MetricCard
          title="Active Feedback"
          value={summary ? Number(summary.activeFeedback) : 0}
          icon={<MessageSquare className="h-5 w-5" />}
        />
        <MetricCard
          title="Avg Rating"
          value={averageRating > 0 ? averageRating.toFixed(2) : "—"}
          icon={<Star className="h-5 w-5" />}
        />
        <MetricCard
          title="Weighted Score"
          value={weightedScore > 0 ? weightedScore.toFixed(2) : "—"}
          icon={<Star className="h-5 w-5" />}
        />
      </div>

      {/* ── Give Feedback form ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="h-4 w-4" />
            Give Feedback
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">Rating</p>
            <StarRating value={newRating} onChange={setNewRating} size="lg" />
          </div>

          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">Comment</p>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              rows={3}
              placeholder="Describe your experience with this agent..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={() => giveFeedback(BigInt(agentId), newRating, newComment.trim())}
              disabled={newRating < 1 || !newComment.trim() || giveIsPending || giveIsConfirming}
            >
              {(giveIsPending || giveIsConfirming) && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              Submit Feedback
            </Button>
            <TransactionStatus
              isPending={giveIsPending}
              isConfirming={giveIsConfirming}
              isSuccess={giveIsSuccess}
              error={giveError}
              hash={giveHash}
              chainId={chainId}
              action="submit feedback"
              successMessage="Feedback recorded on-chain."
              inline
            />
          </div>

          {/* Full status card when not inline enough */}
          {(giveIsPending || giveIsConfirming || giveError) && (
            <TransactionStatus
              isPending={giveIsPending}
              isConfirming={giveIsConfirming}
              isSuccess={false}
              error={giveError}
              hash={giveHash}
              chainId={chainId}
              action="submit feedback"
            />
          )}
        </CardContent>
      </Card>

      {/* ── Feedback list ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Feedback
            {feedbackItems.length > 0 && (
              <Badge variant="secondary" className="text-xs font-normal">
                {feedbackItems.length}
              </Badge>
            )}
          </h3>
          <div className="flex items-center gap-3">
            <Button size="sm" variant="ghost" onClick={fetchData} className="text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Refresh
            </Button>
            {feedbackItems.some((i) => i.feedback.revoked) && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showRevokedItems}
                  onChange={(e) => setShowRevokedItems(e.target.checked)}
                  className="rounded border-border"
                />
                Show revoked
              </label>
            )}
          </div>
        </div>

        {visibleItems.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {feedbackItems.length === 0
                  ? "No feedback yet. Be the first to leave a review."
                  : "No active feedback. Toggle 'Show revoked' to see all."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {visibleItems.map(({ feedback, feedbackId }) => {
              const isReviewer =
                !!connectedWallet &&
                connectedWallet.toLowerCase() === feedback.reviewer.toLowerCase();

              return (
                <FeedbackCard
                  key={feedbackId.toString()}
                  feedback={feedback}
                  feedbackId={feedbackId}
                  isReviewer={isReviewer}
                  isRegistrant={isRegistrant}
                  agentId={BigInt(agentId)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
