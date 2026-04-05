"use client";

import { useState, useCallback } from "react";
import { useChainId } from "wagmi";
import { Card, CardContent, Badge, Button, Input, AddressBadge, useToast } from "@tagit/ui";
import { useRevokeFeedback, useAppendResponse } from "@tagit/contracts";
import { TransactionStatus } from "../transaction-status";
import { StarRating } from "./star-rating";
import { Clock, MessageSquare, Loader2 } from "lucide-react";

interface FeedbackEntry {
  reviewer: string;
  rating: number;
  comment: string;
  response: string;
  timestamp: bigint;
  revoked: boolean;
}

interface FeedbackCardProps {
  feedback: FeedbackEntry;
  feedbackId: bigint;
  isReviewer: boolean;
  isRegistrant: boolean;
  agentId: bigint;
}

function formatTimestamp(ts: bigint): string {
  const ms = Number(ts) * 1000;
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function FeedbackCard({
  feedback,
  feedbackId,
  isReviewer,
  isRegistrant,
}: FeedbackCardProps) {
  const chainId = useChainId();
  const { toast } = useToast();

  const [responseText, setResponseText] = useState("");

  // Revoke hook
  const {
    revoke,
    hash: revokeHash,
    isPending: revokeIsPending,
    isConfirming: revokeIsConfirming,
    isSuccess: revokeIsSuccess,
    error: revokeError,
  } = useRevokeFeedback();

  // Respond hook
  const {
    appendResponse,
    hash: respondHash,
    isPending: respondIsPending,
    isConfirming: respondIsConfirming,
    isSuccess: respondIsSuccess,
    error: respondError,
  } = useAppendResponse();

  const handleRevoke = useCallback(() => {
    revoke(feedbackId);
  }, [revoke, feedbackId]);

  const handleRespond = useCallback(() => {
    if (!responseText.trim()) return;
    appendResponse(feedbackId, responseText.trim());
  }, [appendResponse, feedbackId, responseText]);

  const handleRevokeSuccess = useCallback(() => {
    toast({ title: "Feedback revoked", variant: "success" });
  }, [toast]);

  const handleRespondSuccess = useCallback(() => {
    toast({ title: "Response submitted", variant: "success" });
    setResponseText("");
  }, [toast]);

  const showRevokeButton = isReviewer && !feedback.revoked && !revokeIsSuccess;
  const showRespondForm =
    isRegistrant && !feedback.revoked && !feedback.response && !respondIsSuccess;

  return (
    <Card className={feedback.revoked ? "opacity-60" : undefined}>
      <CardContent className="py-4 space-y-3">
        {/* Header row */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <AddressBadge
              address={feedback.reviewer}
              chainId={chainId}
              truncate
              showCopy
              showEtherscan
            />
            <StarRating value={feedback.rating} readonly size="sm" />
            <span className="text-sm font-medium text-foreground">{feedback.rating}/5</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {feedback.revoked && (
              <Badge variant="secondary" className="text-xs">
                Revoked
              </Badge>
            )}
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatTimestamp(feedback.timestamp)}
            </span>
          </div>
        </div>

        {/* Comment */}
        {feedback.comment && (
          <p className="text-sm text-foreground leading-relaxed">{feedback.comment}</p>
        )}

        {/* Existing response */}
        {feedback.response && (
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2 space-y-1">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              Agent response
            </p>
            <p className="text-sm">{feedback.response}</p>
          </div>
        )}

        {/* Revoke action */}
        {showRevokeButton && (
          <div className="space-y-2">
            <Button
              size="sm"
              variant="outline"
              className="text-destructive border-destructive/50 hover:bg-destructive/10"
              onClick={handleRevoke}
              disabled={revokeIsPending || revokeIsConfirming}
            >
              {(revokeIsPending || revokeIsConfirming) && (
                <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
              )}
              Revoke
            </Button>
            <TransactionStatus
              isPending={revokeIsPending}
              isConfirming={revokeIsConfirming}
              isSuccess={revokeIsSuccess}
              error={revokeError}
              hash={revokeHash}
              chainId={chainId}
              action="revoke feedback"
              successMessage="Feedback revoked successfully."
              inline
              onSuccess={handleRevokeSuccess}
            />
          </div>
        )}

        {/* Respond form */}
        {showRespondForm && (
          <div className="space-y-2 pt-1 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground">Add your response</p>
            <div className="flex gap-2">
              <Input
                placeholder="Write a response..."
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                className="text-sm"
              />
              <Button
                size="sm"
                onClick={handleRespond}
                disabled={!responseText.trim() || respondIsPending || respondIsConfirming}
              >
                {(respondIsPending || respondIsConfirming) && (
                  <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                )}
                Respond
              </Button>
            </div>
            <TransactionStatus
              isPending={respondIsPending}
              isConfirming={respondIsConfirming}
              isSuccess={respondIsSuccess}
              error={respondError}
              hash={respondHash}
              chainId={chainId}
              action="submit response"
              successMessage="Response submitted successfully."
              inline
              onSuccess={handleRespondSuccess}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
