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
  useMint,
  useBindTag,
  useActivate,
  useClaim,
  useFlag,
  useApproveResolve,
  useResolve,
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
  Play,
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
import { LIFECYCLE_STEPS, generateTestMetadataURI } from "@/lib/test-utils";
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
  const [metadataURI, setMetadataURI] = useState("");
  const [tagUID, setTagUID] = useState("");
  const [claimAddress, setClaimAddress] = useState("");
  const [resolveAddress, setResolveAddress] = useState("");

  // Product metadata form
  const [productName, setProductName] = useState("");
  const [productBrand, setProductBrand] = useState("");
  const [productSKU, setProductSKU] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productCategory, setProductCategory] = useState("general");
  const [productOrigin, setProductOrigin] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Contract hooks
  const {
    mint,
    hash: mintHash,
    isPending: mintPending,
    isConfirming: mintConfirming,
    isSuccess: mintSuccess,
    error: mintError,
    tokenId: mintedTokenId,
  } = useMint();
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

  // Initialize metadata URI
  useEffect(() => {
    setMetadataURI(generateTestMetadataURI());
  }, []);

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
    if (tokenId && asset && !mintSuccess) {
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
    if (mintSuccess && mintHash) {
      setStepStates((prev) => ({
        ...prev,
        mint: { completed: true, txHash: mintHash },
      }));
      if (mintedTokenId) {
        setTokenId(mintedTokenId);
      }
      setCurrentStep(1);
    }
  }, [mintSuccess, mintHash, mintedTokenId]);

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

  // After approval succeeds, auto-trigger resolve
  useEffect(() => {
    if (approveResolveSuccess && approveResolveHash && tokenId && resolveAddress) {
      const checksumAddr = getAddress(resolveAddress) as `0x${string}`;
      resolve(tokenId, checksumAddr);
    }
  }, [approveResolveSuccess, approveResolveHash, tokenId, resolveAddress, resolve]);

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
      { step: "mint", error: mintError },
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
  }, [mintError, bindError, activateError, claimError, flagError, resolveError, recycleError]);

  const buildMetadataURI = () => {
    const metadata = {
      name: productName || `Asset ${Date.now()}`,
      description: productDescription || "TAG IT Digital Twin",
      image: "ipfs://QmPlaceholder",
      attributes: [
        ...(productBrand ? [{ trait_type: "Brand", value: productBrand }] : []),
        ...(productSKU ? [{ trait_type: "SKU", value: productSKU }] : []),
        ...(productCategory ? [{ trait_type: "Category", value: productCategory }] : []),
        ...(productOrigin ? [{ trait_type: "Origin", value: productOrigin }] : []),
        { trait_type: "Created", value: new Date().toISOString() },
      ],
      tagit: {
        version: "2.0",
        lifecycle: "MINTED",
        nfcBound: false,
      },
    };
    return `data:application/json;base64,${btoa(JSON.stringify(metadata))}`;
  };

  const handleMint = () => {
    if (!address) return;
    const checksumAddress = getAddress(address);
    const uri = showAdvanced ? metadataURI : buildMetadataURI();
    mint(checksumAddress, uri || generateTestMetadataURI());
  };

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

  const handleResolve = () => {
    if (!tokenId || !resolveAddress) return;
    const checksumAddr = getAddress(resolveAddress) as `0x${string}`;
    approveResolve(tokenId, checksumAddr);
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
    setMetadataURI(generateTestMetadataURI());
    setProductName("");
    setProductBrand("");
    setProductSKU("");
    setProductDescription("");
    setProductCategory("general");
    setProductOrigin("");
    setShowAdvanced(false);
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
              Test the complete asset lifecycle: MINT → BIND → ACTIVATE → CLAIM → FLAG → RESOLVE
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
            ) : stepStates.mint?.completed ? (
              <div className="space-y-4">
                <div className="text-center py-2">
                  <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin text-muted-foreground" />
                  <p className="text-sm font-medium">Extracting Token ID...</p>
                </div>
              </div>
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
            {/* Step 1: Mint */}
            {currentStep === 0 && (
              <>
                {!showAdvanced ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Product Name *</Label>
                        <Input
                          value={productName}
                          onChange={(e) => setProductName(e.target.value)}
                          placeholder="e.g., Nike Air Max 90"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Brand</Label>
                        <Input
                          value={productBrand}
                          onChange={(e) => setProductBrand(e.target.value)}
                          placeholder="e.g., Nike"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>SKU / Serial</Label>
                        <Input
                          value={productSKU}
                          onChange={(e) => setProductSKU(e.target.value)}
                          placeholder="e.g., CW2288-111"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <select
                          value={productCategory}
                          onChange={(e) => setProductCategory(e.target.value)}
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                        >
                          <option value="general">General</option>
                          <option value="footwear">Footwear</option>
                          <option value="apparel">Apparel</option>
                          <option value="electronics">Electronics</option>
                          <option value="luxury">Luxury Goods</option>
                          <option value="pharmaceutical">Pharmaceutical</option>
                          <option value="automotive">Automotive</option>
                          <option value="defense">Defense / Gov</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Manufacturing Origin</Label>
                        <Input
                          value={productOrigin}
                          onChange={(e) => setProductOrigin(e.target.value)}
                          placeholder="e.g., Ho Chi Minh City, Vietnam"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Input
                          value={productDescription}
                          onChange={(e) => setProductDescription(e.target.value)}
                          placeholder="Brief product description"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAdvanced(true)}
                      className="text-xs text-muted-foreground hover:text-foreground underline"
                    >
                      Switch to raw metadata URI
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Metadata URI (Advanced)</Label>
                    <Input
                      value={metadataURI}
                      onChange={(e) => setMetadataURI(e.target.value)}
                      placeholder="ipfs://... or data:application/json;base64,..."
                      className="font-mono text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdvanced(false)}
                      className="text-xs text-muted-foreground hover:text-foreground underline"
                    >
                      Switch to product form
                    </button>
                  </div>
                )}
                <Button
                  onClick={handleMint}
                  disabled={mintPending || mintConfirming || (!showAdvanced && !productName)}
                  className="w-full"
                >
                  {mintPending || mintConfirming ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {mintPending ? "Confirm in wallet..." : "Minting..."}
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Mint Digital Twin
                    </>
                  )}
                </Button>
                {stepStates.mint?.completed && mintedTokenId && (
                  <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-3">
                    <p className="text-sm font-medium text-green-700">
                      Token #{mintedTokenId.toString()} minted successfully
                    </p>
                  </div>
                )}
              </>
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

            {/* Step 6: Resolve */}
            {currentStep === 5 && tokenId && (
              <>
                <div className="rounded-lg border border-primary/50 bg-primary/10 p-4 mb-4">
                  <p className="text-sm">
                    Resolving returns the asset to the rightful owner after AIRP recovery. This
                    requires two wallet confirmations: approval + execution. Enter the address of
                    the verified owner.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Rightful Owner Address</Label>
                  <Input
                    value={resolveAddress}
                    onChange={(e) => setResolveAddress(e.target.value)}
                    placeholder="0x..."
                    className="font-mono"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => address && setResolveAddress(address)}
                    >
                      Use My Address
                    </Button>
                  </div>
                </div>
                <Button
                  onClick={handleResolve}
                  disabled={
                    !resolveAddress ||
                    approveResolvePending ||
                    approveResolveConfirming ||
                    resolvePending ||
                    resolveConfirming
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
                  ) : resolvePending ? (
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
                      Approve &amp; Resolve
                    </>
                  )}
                </Button>
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
