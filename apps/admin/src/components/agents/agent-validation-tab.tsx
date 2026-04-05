"use client";

import { useState, useEffect, useCallback } from "react";
import { usePublicClient, useChainId, useAccount } from "wagmi";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Badge,
  Button,
  Label,
  Input,
  AddressBadge,
} from "@tagit/ui";
import {
  useValidationRequest,
  useValidationResponse,
  getAgentContractsForChain,
  TAGITAgentValidationABI,
  RequestStatus,
  RequestStatusNames,
  type RequestStatusType,
  type ValidationRequest,
  type ValidatorResponse,
  type ValidationSummary,
} from "@tagit/contracts";
import { TransactionStatus } from "@/components/transaction-status";
import {
  ShieldCheck,
  ShieldX,
  ChevronDown,
  ChevronRight,
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface AgentValidationTabProps {
  agentId: number;
}

interface RequestWithId extends ValidationRequest {
  requestId: bigint;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function statusBadgeClass(status: RequestStatusType): string {
  switch (status) {
    case RequestStatus.PENDING:
      return "bg-yellow-500/20 text-yellow-500 border-yellow-500/30";
    case RequestStatus.IN_PROGRESS:
      return "bg-blue-500/20 text-blue-500 border-blue-500/30";
    case RequestStatus.VALIDATED:
      return "bg-green-500/20 text-green-500 border-green-500/30";
    case RequestStatus.REJECTED:
      return "bg-red-500/20 text-red-500 border-red-500/30";
    case RequestStatus.EXPIRED:
      return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function formatTimestamp(ts: bigint): string {
  if (ts === 0n) return "—";
  return new Date(Number(ts) * 1000).toLocaleString();
}

// ── Validation Summary Card ───────────────────────────────────────────────────

interface SummaryCardProps {
  summary: ValidationSummary | null;
  loading: boolean;
}

function ValidationSummaryCard({ summary, loading }: SummaryCardProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!summary) {
    return (
      <Card className="border-muted">
        <CardContent className="py-6 flex items-center gap-2 text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">Could not load validation summary.</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" />
          Validation Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <div className="text-center">
            <p className="text-2xl font-bold">{String(summary.totalRequests)}</p>
            <p className="text-xs text-muted-foreground">Total Requests</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-500">{String(summary.passedCount)}</p>
            <p className="text-xs text-muted-foreground">Passed</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-500">{String(summary.failedCount)}</p>
            <p className="text-xs text-muted-foreground">Failed</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{String(summary.latestScore)}</p>
            <p className="text-xs text-muted-foreground">Latest Score</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {summary.isValidated ? (
            <>
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm text-green-500 font-medium">Validated</span>
            </>
          ) : (
            <>
              <ShieldX className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Not yet validated</span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Request Validation Form ───────────────────────────────────────────────────

interface RequestValidationFormProps {
  agentId: number;
  chainId: number;
  onSuccess: () => void;
}

function RequestValidationForm({ agentId, chainId, onSuccess }: RequestValidationFormProps) {
  const [isDefense, setIsDefense] = useState(false);
  const { requestValidation, hash, isPending, isConfirming, isSuccess, error } =
    useValidationRequest();

  useEffect(() => {
    if (isSuccess) {
      onSuccess();
    }
  }, [isSuccess, onSuccess]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Request Validation</CardTitle>
        <CardDescription>
          Submit a new validation request for this agent. Validators will review and score the
          agent.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <input
            id="defense-mode"
            type="checkbox"
            checked={isDefense}
            onChange={(e) => setIsDefense(e.target.checked)}
            className="h-4 w-4 rounded border-border accent-primary"
          />
          <Label htmlFor="defense-mode" className="cursor-pointer">
            Defense mode
            <span className="block text-xs text-muted-foreground font-normal">
              Request validation in response to a challenge or dispute
            </span>
          </Label>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => requestValidation(BigInt(agentId), isDefense)}
            disabled={isPending || isConfirming}
          >
            {(isPending || isConfirming) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Request Validation
          </Button>
          {isDefense && (
            <Badge variant="outline" className="text-xs">
              Defense
            </Badge>
          )}
        </div>

        <TransactionStatus
          isPending={isPending}
          isConfirming={isConfirming}
          isSuccess={isSuccess}
          error={error}
          hash={hash}
          chainId={chainId}
          action="request validation"
          successMessage="Validation request submitted successfully."
        />
      </CardContent>
    </Card>
  );
}

// ── Submit Response Form ──────────────────────────────────────────────────────

interface SubmitResponseFormProps {
  requestId: bigint;
  chainId: number;
  onSuccess: () => void;
}

function SubmitResponseForm({ requestId, chainId, onSuccess }: SubmitResponseFormProps) {
  const [score, setScore] = useState(50);
  const [justification, setJustification] = useState("");
  const { submitResponse, hash, isPending, isConfirming, isSuccess, error } =
    useValidationResponse();

  useEffect(() => {
    if (isSuccess) {
      setJustification("");
      setScore(50);
      onSuccess();
    }
  }, [isSuccess, onSuccess]);

  const canSubmit = justification.trim().length >= 10 && !isPending && !isConfirming;

  return (
    <div className="mt-3 pt-3 border-t space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Submit Your Response
      </p>
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label htmlFor={`score-${requestId}`} className="text-sm">
            Score
          </Label>
          <span className="text-sm font-mono font-bold">{score}/100</span>
        </div>
        <input
          id={`score-${requestId}`}
          type="range"
          min={0}
          max={100}
          value={score}
          onChange={(e) => setScore(Number(e.target.value))}
          className="w-full accent-primary"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`justification-${requestId}`} className="text-sm">
          Justification
        </Label>
        <textarea
          id={`justification-${requestId}`}
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          placeholder="Describe your assessment of this agent (min 10 characters)..."
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
        />
      </div>
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          onClick={() => submitResponse(requestId, score, justification)}
          disabled={!canSubmit}
        >
          {(isPending || isConfirming) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Submit Response
        </Button>
        <TransactionStatus
          isPending={isPending}
          isConfirming={isConfirming}
          isSuccess={isSuccess}
          error={error}
          hash={hash}
          chainId={chainId}
          action="submit validation response"
          successMessage="Response submitted."
          inline
        />
      </div>
    </div>
  );
}

// ── Request Row ───────────────────────────────────────────────────────────────

interface RequestRowProps {
  req: RequestWithId;
  chainId: number;
  validationAddress: `0x${string}`;
  connectedAddress: `0x${string}` | undefined;
  onResponseSuccess: () => void;
}

function RequestRow({
  req,
  chainId,
  validationAddress,
  connectedAddress,
  onResponseSuccess,
}: RequestRowProps) {
  const client = usePublicClient();
  const [expanded, setExpanded] = useState(false);
  const [responses, setResponses] = useState<ValidatorResponse[]>([]);
  const [loadingResponses, setLoadingResponses] = useState(false);
  const [alreadyResponded, setAlreadyResponded] = useState(false);

  const fetchResponses = useCallback(async () => {
    if (!client || !expanded) return;
    setLoadingResponses(true);
    try {
      const result = await client.readContract({
        address: validationAddress,
        abi: TAGITAgentValidationABI,
        functionName: "getResponses",
        args: [req.requestId],
      });
      setResponses(result as ValidatorResponse[]);

      if (connectedAddress) {
        const responded = await client.readContract({
          address: validationAddress,
          abi: TAGITAgentValidationABI,
          functionName: "hasValidatorResponded",
          args: [req.requestId, connectedAddress],
        });
        setAlreadyResponded(responded as boolean);
      }
    } catch {
      // responses may not be accessible; silently ignore
    } finally {
      setLoadingResponses(false);
    }
  }, [client, expanded, validationAddress, req.requestId, connectedAddress]);

  useEffect(() => {
    fetchResponses();
  }, [fetchResponses]);

  const isOpen = req.status === RequestStatus.PENDING || req.status === RequestStatus.IN_PROGRESS;

  return (
    <div className="rounded-lg border">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <span className="font-mono text-sm text-muted-foreground shrink-0">
            #{String(req.requestId)}
          </span>
          <AddressBadge address={req.requester} chainId={chainId} truncate />
          {req.isDefense && (
            <Badge variant="outline" className="text-xs shrink-0">
              Defense
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-3">
          <span className="text-xs text-muted-foreground hidden sm:block">
            {req.responseCount}/{req.quorum} responses
          </span>
          <Badge className={`text-xs border ${statusBadgeClass(req.status)}`}>
            {RequestStatusNames[req.status]}
          </Badge>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t pt-3">
          {/* Request metadata */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Quorum</p>
              <p className="font-medium">{req.quorum}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Responses</p>
              <p className="font-medium">{req.responseCount}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Type</p>
              <p className="font-medium">{req.isDefense ? "Defense" : "Standard"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Created</p>
              <p className="font-medium text-xs">{formatTimestamp(req.createdAt)}</p>
            </div>
          </div>

          {/* Responses */}
          {loadingResponses ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading responses...
            </div>
          ) : responses.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Validator Responses
              </p>
              {responses.map((resp, i) => (
                <div key={i} className="rounded-md bg-muted/50 px-3 py-2 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <AddressBadge address={resp.validator} chainId={chainId} truncate />
                    <span className="text-sm font-bold shrink-0">{resp.score}/100</span>
                  </div>
                  {resp.justification && (
                    <p className="text-xs text-muted-foreground">{resp.justification}</p>
                  )}
                  <p className="text-xs text-muted-foreground/60">
                    <Clock className="h-3 w-3 inline mr-1" />
                    {formatTimestamp(resp.timestamp)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No responses yet.</p>
          )}

          {/* Submit response form — show for open requests if not already responded */}
          {isOpen && connectedAddress && !alreadyResponded && (
            <SubmitResponseForm
              requestId={req.requestId}
              chainId={chainId}
              onSuccess={() => {
                fetchResponses();
                onResponseSuccess();
              }}
            />
          )}

          {isOpen && alreadyResponded && (
            <p className="text-xs text-muted-foreground pt-2 border-t">
              You have already submitted a response to this request.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function AgentValidationTab({ agentId }: AgentValidationTabProps) {
  const chainId = useChainId();
  const client = usePublicClient();
  const { address: connectedAddress } = useAccount();

  const [summary, setSummary] = useState<ValidationSummary | null>(null);
  const [requests, setRequests] = useState<RequestWithId[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  let contracts: ReturnType<typeof getAgentContractsForChain> | null = null;
  try {
    contracts = getAgentContractsForChain(chainId);
  } catch {
    // unsupported chain
  }

  const validationAddress = contracts?.TAGITAgentValidation;

  const fetchSummary = useCallback(async () => {
    if (!client || !validationAddress) return;
    setLoadingSummary(true);
    try {
      const result = await client.readContract({
        address: validationAddress,
        abi: TAGITAgentValidationABI,
        functionName: "getSummary",
        args: [BigInt(agentId)],
      });
      setSummary(result as ValidationSummary);
    } catch (err) {
      setSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  }, [client, validationAddress, agentId]);

  const fetchRequests = useCallback(async () => {
    if (!client || !validationAddress) return;
    setLoadingRequests(true);
    setFetchError(null);
    try {
      const ids = (await client.readContract({
        address: validationAddress,
        abi: TAGITAgentValidationABI,
        functionName: "getAgentRequests",
        args: [BigInt(agentId)],
      })) as bigint[];

      const resolved = await Promise.all(
        ids.map(async (id) => {
          const req = (await client.readContract({
            address: validationAddress,
            abi: TAGITAgentValidationABI,
            functionName: "getRequest",
            args: [id],
          })) as ValidationRequest;
          return { ...req, requestId: id } satisfies RequestWithId;
        }),
      );

      // Most recent first
      setRequests(resolved.slice().reverse());
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load validation history.");
    } finally {
      setLoadingRequests(false);
    }
  }, [client, validationAddress, agentId]);

  const refresh = useCallback(() => {
    fetchSummary();
    fetchRequests();
  }, [fetchSummary, fetchRequests]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!contracts || !validationAddress) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="py-6 flex items-center gap-2 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">No validation contract configured for chain {chainId}.</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <ValidationSummaryCard summary={summary} loading={loadingSummary} />

      {/* Request Validation */}
      <RequestValidationForm agentId={agentId} chainId={chainId} onSuccess={refresh} />

      {/* History */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Validation History</CardTitle>
              <CardDescription>All validation requests for this agent</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={refresh} disabled={loadingRequests}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loadingRequests ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {fetchError && (
            <div className="flex items-center gap-2 text-destructive text-sm mb-4">
              <AlertCircle className="h-4 w-4" />
              {fetchError}
            </div>
          )}

          {loadingRequests ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : requests.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No validation requests have been submitted for this agent yet.
            </p>
          ) : (
            <div className="space-y-2">
              {requests.map((req) => (
                <RequestRow
                  key={String(req.requestId)}
                  req={req}
                  chainId={chainId}
                  validationAddress={validationAddress}
                  connectedAddress={connectedAddress}
                  onResponseSuccess={refresh}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
