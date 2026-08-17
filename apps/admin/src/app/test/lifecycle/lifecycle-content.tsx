"use client";

import { useState, useEffect } from "react";
import { getAddress } from "viem";
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  Button,
  Input,
  Label,
  StateBadge,
  AddressBadge,
} from "@tagit/ui";
import {
  useBindTag,
  useActivate,
  useClaim,
  useFlag,
  useApproveResolve,
  useResolve,
  useResolveApprovalStatus,
  useRecycle,
  useAsset,
  useTagByToken,
  useAccount,
  getExplorerTxUrl,
  AssetState,
} from "@tagit/contracts";
import { useChainId } from "wagmi";
import {
  ArrowLeft,
  Check,
  Loader2,
  AlertCircle,
  ExternalLink,
  RotateCcw,
  Nfc,
  Package,
  Zap,
  UserCheck,
  Flag,
  Scale,
  RefreshCw,
  Search,
} from "lucide-react";
import { BindTagModal } from "@/components/bind-tag-modal";
import { LIFECYCLE_STEPS } from "@/lib/test-utils";
import { generateTestUID, uidToTagId, formatUID, truncateTagId } from "@/lib/tag-utils";

interface StepState {
  completed: boolean;
  txHash?: string;
  error?: string;
  data?: Record<string, unknown>;
}

const stepIcons: Record<string, React.ReactNode> = {
  mint: <Package className="h-5 w-5" />,
  bind: <Nfc className="h-5 w-5" />,
  activate: <Zap className="h-5 w-5" />,
  claim: <UserCheck className="h-5 w-5" />,
  flag: <Flag className="h-5 w-5" />,
  resolve: <Scale className="h-5 w-5" />,
  recycle: <RefreshCw className="h-5 w-5" />,
};

export function LifecycleContent() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  // Test session state
  const [tokenId, setTokenId] = useState<bigint | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepStates, setStepStates] = useState<Record<string, StepState>>({});
  const [bindModalOpen, setBindModalOpen] = useState(false);

  // Resume existing token
  const [resumeInput, setResumeInput] = useState("");

  // Form inputs
  const [tagUID, setTagUID] = useState("");
  const [claimAddress, setClaimAddress] = useState("");
  const [resolveAddress, setResolveAddress] = useState("");

  // META-T18: the mint path is RETIRED from this test harness. Minting goes
  // through /assets/new (DB-first via tagit-services); this page continues an
  // EXISTING token's lifecycle from BIND onward.

  // Contract hooks
  const {
    bindTag,
    hash: bindHash,
    isPending: bindPending,
    isConfirming: bindConfirming,
    isSuccess: bindSuccess,
    error: bindError,
  } = useBindTag();
  const {
    activate,
    hash: activateHash,
    isPending: activatePending,
    isConfirming: activateConfirming,
    isSuccess: activateSuccess,
    error: activateError,
  } = useActivate();
  const {
    claim,
    hash: claimHash,
    isPending: claimPending,
    isConfirming: claimConfirming,
    isSuccess: claimSuccess,
    error: claimError,
  } = useClaim();
  const {
    flag,
    hash: flagHash,
    isPending: flagPending,
    isConfirming: flagConfirming,
    isSuccess: flagSuccess,
    error: flagError,
  } = useFlag();
  const {
    approveResolve,
    hash: approveResolveHash,
    isPending: approveResolvePending,
    isConfirming: approveResolveConfirming,
    isSuccess: approveResolveSuccess,
    error: approveResolveError,
  } = useApproveResolve();
  const {
    resolve,
    hash: resolveHash,
    isPending: resolvePending,
    isConfirming: resolveConfirming,
    isSuccess: resolveSuccess,
    error: resolveError,
  } = useResolve();
  const {
    recycle,
    hash: recycleHash,
    isPending: recyclePending,
    isConfirming: recycleConfirming,
    isSuccess: recycleSuccess,
    error: recycleError,
  } = useRecycle();

  // Fetch asset data
  const { asset, refetch: refetchAsset } = useAsset(tokenId ?? 0n);
  const { data: tagHash } = useTagByToken(tokenId ?? 0n);

  // Live resolve quorum status (2-of-3) for the current token
  const {
    approvalCount: resolveApprovals,
    recipient: resolveLockedRecipient,
    quorumReached: resolveQuorumReached,
    refetch: refetchResolveStatus,
  } = useResolveApprovalStatus(tokenId ?? 0n);

  // Map on-chain asset state to the next lifecycle step
  const stateToStep: Record<number, number> = {
    [AssetState.MINTED]: 1, // next: bind
    [AssetState.BOUND]: 2, // next: activate
    [AssetState.ACTIVATED]: 3, // next: claim
    [AssetState.CLAIMED]: 4, // next: flag
    [AssetState.FLAGGED]: 5, // next: resolve
    [AssetState.RECYCLED]: 6, // done
  };

  // When loading an existing token, sync step from on-chain state
  useEffect(() => {
    if (tokenId && asset) {
      const step = stateToStep[asset.state] ?? 0;
      setCurrentStep(step);
      // Mark prior steps as completed
      const stepIds = LIFECYCLE_STEPS.map((s) => s.id);
      const newStates: Record<string, StepState> = {};
      for (let i = 0; i < step; i++) {
        newStates[stepIds[i]] = { completed: true };
      }
      setStepStates(newStates);
    }
  }, [tokenId, asset?.state]);

  const handleResumeToken = () => {
    const id = parseInt(resumeInput);
    if (!id || id <= 0) return;
    setTokenId(BigInt(id));
    setResumeInput("");
  };

  // Track step completions
  useEffect(() => {
    if (bindSuccess && bindHash) {
      setStepStates((prev) => ({
        ...prev,
        bind: { completed: true, txHash: bindHash },
      }));
      setCurrentStep(2);
      refetchAsset();
    }
  }, [bindSuccess, bindHash, refetchAsset]);

  useEffect(() => {
    if (activateSuccess && activateHash) {
      setStepStates((prev) => ({
        ...prev,
        activate: { completed: true, txHash: activateHash },
      }));
      setCurrentStep(3);
      refetchAsset();
    }
  }, [activateSuccess, activateHash, refetchAsset]);

  useEffect(() => {
    if (claimSuccess && claimHash) {
      setStepStates((prev) => ({
        ...prev,
        claim: { completed: true, txHash: claimHash },
      }));
      setCurrentStep(4);
      refetchAsset();
    }
  }, [claimSuccess, claimHash, refetchAsset]);

  useEffect(() => {
    if (flagSuccess && flagHash) {
      setStepStates((prev) => ({
        ...prev,
        flag: { completed: true, txHash: flagHash },
      }));
      setCurrentStep(5);
      refetchAsset();
    }
  }, [flagSuccess, flagHash, refetchAsset]);

  // After an approval confirms, re-read quorum status so the UI shows the new
  // approval count. We do NOT auto-fire resolve() — a 2-of-3 needs a second
  // approval from a different wallet first, so resolve is a separate gated step.
  useEffect(() => {
    if (approveResolveSuccess && approveResolveHash) {
      const t = setTimeout(() => refetchResolveStatus(), 2000);
      return () => clearTimeout(t);
    }
  }, [approveResolveSuccess, approveResolveHash, refetchResolveStatus]);

  useEffect(() => {
    if (resolveSuccess && resolveHash) {
      setStepStates((prev) => ({
        ...prev,
        resolve: { completed: true, txHash: resolveHash },
      }));
      setCurrentStep(6);
      refetchAsset();
    }
  }, [resolveSuccess, resolveHash, refetchAsset]);

  useEffect(() => {
    if (recycleSuccess && recycleHash) {
      setStepStates((prev) => ({
        ...prev,
        recycle: { completed: true, txHash: recycleHash },
      }));
      refetchAsset();
    }
  }, [recycleSuccess, recycleHash, refetchAsset]);

  // Handle errors
  useEffect(() => {
    const errors = [
      { step: "bind", error: bindError },
      { step: "activate", error: activateError },
      { step: "claim", error: claimError },
      { step: "flag", error: flagError },
      { step: "resolve", error: approveResolveError || resolveError },
      { step: "recycle", error: recycleError },
    ];

    errors.forEach(({ step, error }) => {
      if (error) {
        setStepStates((prev) => ({
          ...prev,
          [step]: { ...prev[step], completed: false, error: error.message },
        }));
      }
    });
  }, [bindError, activateError, claimError, flagError, resolveError, recycleError]);

  const handleBindWithModal = () => {
    setBindModalOpen(true);
  };

  const handleBindDirect = async () => {
    if (!tokenId || !tagUID) return;
    const tagId = uidToTagId(formatUID(tagUID));
    await bindTag(tokenId, tagId);
  };

  const handleActivate = () => {
    if (!tokenId) return;
    activate(tokenId);
  };

  const handleClaim = () => {
    if (!tokenId || !claimAddress) return;
    const checksumAddr = getAddress(claimAddress) as `0x${string}`;
    claim(tokenId, checksumAddr);
  };

  const handleFlag = () => {
    if (!tokenId) return;
    flag(tokenId);
  };

  // Once the first approver locks a recipient on-chain, that address is binding —
  // subsequent approvals and the final resolve must reuse it or the contract reverts.
  const RESOLVE_ZERO = "0x0000000000000000000000000000000000000000";
  const resolveRecipientLocked =
    resolveLockedRecipient && resolveLockedRecipient !== RESOLVE_ZERO
      ? (resolveLockedRecipient as `0x${string}`)
      : null;
  const resolveEffectiveOwner = resolveRecipientLocked ?? (resolveAddress || null);
  const resolveApprovalsNum = resolveApprovals !== undefined ? Number(resolveApprovals) : 0;

  // Step 1/2: current connected wallet approves. Uses the locked recipient if one
  // exists, otherwise the entered address (which the first approval will lock in).
  const handleResolve = () => {
    if (!tokenId || !resolveEffectiveOwner) return;
    const checksumAddr = getAddress(resolveEffectiveOwner) as `0x${string}`;
    approveResolve(tokenId, checksumAddr);
  };

  // Step 3: execute once quorum (2-of-3) is reached.
  const handleExecuteResolve = () => {
    if (!tokenId || !resolveEffectiveOwner || !resolveQuorumReached) return;
    const checksumAddr = getAddress(resolveEffectiveOwner) as `0x${string}`;
    resolve(tokenId, checksumAddr);
  };

  const handleRecycle = () => {
    if (!tokenId) return;
    recycle(tokenId);
  };

  const resetTest = () => {
    setTokenId(null);
    setCurrentStep(0);
    setStepStates({});
    setTagUID("");
    setClaimAddress("");
    setResolveAddress("");
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Wallet Not Connected</h2>
        <p className="text-muted-foreground">Please connect your wallet to run lifecycle tests</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">NFC Lifecycle Test</h1>
            <p className="text-muted-foreground">
              Continue an existing asset&apos;s lifecycle: BIND → ACTIVATE → CLAIM → FLAG → RESOLVE.
              Minting happens at{" "}
              <Link href="/assets/new" className="underline">
                /assets/new
              </Link>
              .
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={resetTest}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset Test
        </Button>
      </div>

      {/* Progress Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            {LIFECYCLE_STEPS.map((step, index) => {
              const state = stepStates[step.id];
              const isActive = currentStep === index;
              const isCompleted = state?.completed;
              const hasError = state?.error;

              return (
                <div key={step.id} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                        isCompleted
                          ? "bg-green-500 border-green-500 text-white"
                          : hasError
                            ? "bg-destructive border-destructive text-white"
                            : isActive
                              ? "bg-primary border-primary text-primary-foreground"
                              : "bg-muted border-border text-muted-foreground"
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="h-5 w-5" />
                      ) : hasError ? (
                        <AlertCircle className="h-5 w-5" />
                      ) : (
                        stepIcons[step.id]
                      )}
                    </div>
                    <span
                      className={`text-xs mt-2 ${
                        isActive ? "font-medium" : "text-muted-foreground"
                      }`}
                    >
                      {step.name}
                    </span>
                  </div>
                  {index < LIFECYCLE_STEPS.length - 1 && (
                    <div
                      className={`w-12 h-0.5 mx-2 ${
                        stepStates[step.id]?.completed ? "bg-green-500" : "bg-border"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Current Asset Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current Asset</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {tokenId ? (
              <>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Token ID</p>
                  <p className="font-mono text-lg font-bold">#{tokenId.toString()}</p>
                </div>
                {asset && (
                  <>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">State</p>
                      <StateBadge state={asset.state} />
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Owner</p>
                      <AddressBadge address={asset.owner} chainId={chainId} truncate />
                    </div>
                    {tagHash &&
                      tagHash !==
                        "0x0000000000000000000000000000000000000000000000000000000000000000" && (
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">Tag ID</p>
                          <code className="text-xs break-all">{truncateTagId(tagHash)}</code>
                        </div>
                      )}
                  </>
                )}
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href={`/assets/${tokenId!.toString()}`}>
                    View Asset Details
                    <ExternalLink className="h-3 w-3 ml-2" />
                  </Link>
                </Button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="text-center py-2">
                  <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No asset selected</p>
                </div>
                <div className="border-t pt-4 space-y-2">
                  <Label>Resume Existing Token</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min="1"
                      value={resumeInput}
                      onChange={(e) => setResumeInput(e.target.value)}
                      placeholder="Token ID (e.g., 9)"
                      className="font-mono"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleResumeToken}
                      disabled={!resumeInput}
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Enter an existing token ID to continue its lifecycle
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step Actions */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              Step {currentStep + 1}: {LIFECYCLE_STEPS[currentStep]?.name}
            </CardTitle>
            <CardDescription>{LIFECYCLE_STEPS[currentStep]?.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Step 1: Mint — RETIRED (META-T18). Minting is DB-first via
                tagit-services at /assets/new; this harness only continues an
                existing token's lifecycle. */}
            {currentStep === 0 && !tokenId && (
              <div className="space-y-4">
                <div className="rounded-lg border border-primary/50 bg-primary/10 p-4">
                  <p className="text-sm">
                    Minting has moved to the <strong>Mint Asset</strong> form, which mints through
                    tagit-services (DB-first, relayer-signed) instead of a raw wallet transaction.
                    Mint there, then enter the new token id under &quot;Resume Existing Token&quot;
                    to continue its lifecycle here.
                  </p>
                </div>
                <Button asChild className="w-full">
                  <Link href="/assets/new">
                    <Package className="h-4 w-4 mr-2" />
                    Open Mint Asset form
                  </Link>
                </Button>
              </div>
            )}

            {/* Step 2: Bind */}
            {currentStep === 1 && tokenId && (
              <>
                <div className="space-y-2">
                  <Label>Tag UID</Label>
                  <div className="flex gap-2">
                    <Input
                      value={tagUID}
                      onChange={(e) => setTagUID(e.target.value)}
                      placeholder="04:A1:B2:C3:D4:E5:F6"
                      className="font-mono"
                    />
                    <Button variant="outline" onClick={() => setTagUID(generateTestUID())}>
                      Random
                    </Button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleBindDirect}
                    disabled={!tagUID || bindPending || bindConfirming}
                    className="flex-1"
                  >
                    {bindPending || bindConfirming ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Binding...
                      </>
                    ) : (
                      <>
                        <Nfc className="h-4 w-4 mr-2" />
                        Bind Tag (Manual)
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={handleBindWithModal}>
                    <Nfc className="h-4 w-4 mr-2" />
                    Use NFC Scanner
                  </Button>
                </div>
              </>
            )}

            {/* Step 3: Activate */}
            {currentStep === 2 && tokenId && (
              <Button
                onClick={handleActivate}
                disabled={activatePending || activateConfirming}
                className="w-full"
              >
                {activatePending || activateConfirming ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Activating...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Simulate First NFC Scan (Activate)
                  </>
                )}
              </Button>
            )}

            {/* Step 4: Claim */}
            {currentStep === 3 && tokenId && (
              <>
                <div className="space-y-2">
                  <Label>New Owner Address</Label>
                  <Input
                    value={claimAddress}
                    onChange={(e) => setClaimAddress(e.target.value)}
                    placeholder="0x..."
                    className="font-mono"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => address && setClaimAddress(address)}
                    >
                      Use My Address
                    </Button>
                  </div>
                </div>
                <Button
                  onClick={handleClaim}
                  disabled={!claimAddress || claimPending || claimConfirming}
                  className="w-full"
                >
                  {claimPending || claimConfirming ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Claiming...
                    </>
                  ) : (
                    <>
                      <UserCheck className="h-4 w-4 mr-2" />
                      Claim Ownership
                    </>
                  )}
                </Button>
              </>
            )}

            {/* Step 5: Flag */}
            {currentStep === 4 && tokenId && (
              <>
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 mb-4">
                  <p className="text-sm">
                    Flagging marks an asset as lost, stolen, or subject to recall. This initiates
                    the AIRP recovery protocol.
                  </p>
                </div>
                <Button
                  onClick={handleFlag}
                  disabled={flagPending || flagConfirming}
                  className="w-full"
                  variant="destructive"
                >
                  {flagPending || flagConfirming ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Flagging...
                    </>
                  ) : (
                    <>
                      <Flag className="h-4 w-4 mr-2" />
                      Flag Asset
                    </>
                  )}
                </Button>
              </>
            )}

            {/* Step 6: Resolve (2-of-3 quorum) */}
            {currentStep === 5 && tokenId && (
              <>
                <div className="rounded-lg border border-primary/50 bg-primary/10 p-4 mb-4">
                  <p className="text-sm">
                    Resolving returns a flagged asset to the rightful owner. It needs a{" "}
                    <strong>2-of-3 resolver quorum</strong>: two <em>different</em> RESOLVER wallets
                    approve, then any resolver executes. Approve with one wallet, switch accounts in
                    your wallet extension, approve with a second, then execute.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Rightful Owner Address</Label>
                  <Input
                    value={resolveRecipientLocked ?? resolveAddress}
                    onChange={(e) => setResolveAddress(e.target.value)}
                    placeholder="0x..."
                    className="font-mono"
                    disabled={!!resolveRecipientLocked}
                  />
                  {resolveRecipientLocked ? (
                    <p className="text-xs text-muted-foreground">
                      Recipient locked by the first approver — used for all approvals + execution.
                    </p>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => address && setResolveAddress(address)}
                      >
                        Use My Address
                      </Button>
                    </div>
                  )}
                </div>

                {/* Quorum progress */}
                <div className="rounded-lg border bg-muted/40 p-3 my-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Approvals</span>
                    <span className="font-mono font-medium">
                      {resolveApprovalsNum} / 2{" "}
                      {resolveQuorumReached && <span className="text-green-500">✓</span>}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Connected wallet</span>
                    <span className="font-mono text-xs">
                      {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "not connected"}
                    </span>
                  </div>
                </div>

                {/* Step 1/2: approve */}
                {!resolveQuorumReached && (
                  <>
                    <Button
                      onClick={handleResolve}
                      disabled={
                        !resolveEffectiveOwner || approveResolvePending || approveResolveConfirming
                      }
                      className="w-full"
                    >
                      {approveResolvePending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Approve in wallet...
                        </>
                      ) : approveResolveConfirming ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Approval confirming...
                        </>
                      ) : (
                        <>
                          <Scale className="h-4 w-4 mr-2" />
                          Approve with this wallet ({resolveApprovalsNum === 0 ? "1st" : "2nd"} of
                          2)
                        </>
                      )}
                    </Button>
                    {resolveApprovalsNum > 0 && (
                      <p className="text-xs text-amber-500 mt-2">
                        ⚠️ Now switch to your <strong>second</strong> RESOLVER account in your
                        wallet extension, then approve again. The same address can&apos;t approve
                        twice.
                      </p>
                    )}
                  </>
                )}

                {/* Step 3: execute */}
                {resolveQuorumReached && (
                  <Button
                    onClick={handleExecuteResolve}
                    disabled={resolvePending || resolveConfirming}
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                  >
                    {resolvePending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Confirm resolve in wallet...
                      </>
                    ) : resolveConfirming ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Resolving...
                      </>
                    ) : (
                      <>
                        <Scale className="h-4 w-4 mr-2" />
                        Execute Resolve &amp; Transfer
                      </>
                    )}
                  </Button>
                )}
              </>
            )}

            {/* Step 7: Recycle (Optional) */}
            {currentStep === 6 && tokenId && (
              <>
                <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4 mb-4">
                  <p className="text-sm">
                    <strong>Optional:</strong> Recycle prepares the asset for reuse with a new tag.
                    This is typically used when the physical item is being repurposed.
                  </p>
                </div>
                <Button
                  onClick={handleRecycle}
                  disabled={recyclePending || recycleConfirming}
                  className="w-full"
                  variant="outline"
                >
                  {recyclePending || recycleConfirming ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Recycling...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Recycle Asset (Optional)
                    </>
                  )}
                </Button>
              </>
            )}

            {/* Transaction Links */}
            {Object.entries(stepStates).some(([_, state]) => state.txHash) && (
              <div className="pt-4 border-t space-y-2">
                <p className="text-sm font-medium">Transaction History</p>
                {Object.entries(stepStates)
                  .filter(([_, state]) => state.txHash)
                  .map(([stepId, state]) => (
                    <a
                      key={stepId}
                      href={getExplorerTxUrl(chainId, state.txHash!)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <Check className="h-3 w-3" />
                      {LIFECYCLE_STEPS.find((s) => s.id === stepId)?.name}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ))}
              </div>
            )}

            {/* Errors */}
            {Object.entries(stepStates).some(([_, state]) => state.error) && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                  <div>
                    <p className="font-medium text-destructive">Error</p>
                    {Object.entries(stepStates)
                      .filter(([_, state]) => state.error)
                      .map(([stepId, state]) => (
                        <p key={stepId} className="text-sm text-muted-foreground">
                          {LIFECYCLE_STEPS.find((s) => s.id === stepId)?.name}: {state.error}
                        </p>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bind Tag Modal */}
      {tokenId && (
        <BindTagModal
          open={bindModalOpen}
          onOpenChange={setBindModalOpen}
          tokenId={tokenId}
          onSuccess={() => {
            setBindModalOpen(false);
            refetchAsset();
          }}
        />
      )}
    </div>
  );
}
