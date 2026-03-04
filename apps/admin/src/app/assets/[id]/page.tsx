"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  useAsset,
  useAssetState,
  useTagByToken,
  useAssetHistory,
  useActivate,
  useFlag,
  useRecycle,
  AssetState,
  AssetStateNames,
  getExplorerTxUrl,
  getContractsForChain,
  shortenAddress,
} from "@tagit/contracts";
import { useChainId } from "wagmi";
import { WagmiGuard } from "@/components/wagmi-guard";
import { BindTagModal } from "@/components/bind-tag-modal";
import { TransferModal } from "@/components/transfer-modal";
import { TransactionStatus } from "@/components/transaction-status";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Badge,
  StateBadge,
  AddressBadge,
} from "@tagit/ui";
import {
  ArrowLeft,
  Link2,
  Zap,
  Flag,
  RotateCcw,
  ExternalLink,
  Clock,
  User,
  Hash,
  CheckCircle,
  ArrowRightLeft,
  Loader2,
} from "lucide-react";

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function computeAgeText(timestampMs: number): string {
  if (timestampMs <= 0) return "—";
  const days = Math.floor((Date.now() - timestampMs) / (1000 * 60 * 60 * 24));
  if (days === 0) return "< 1 day";
  if (days === 1) return "1 day";
  return `${days} days`;
}

interface AssetDetailPageProps {
  params: { id: string };
}

export default function AssetDetailPage({ params }: AssetDetailPageProps) {
  return (
    <WagmiGuard>
      <AssetDetailContent id={params.id} />
    </WagmiGuard>
  );
}

function AssetDetailContent({ id }: { id: string }) {
  const chainId = useChainId();
  const tokenId = BigInt(id);

  const { asset, isLoading: assetLoading, error: assetError, refetch } = useAsset(tokenId);
  const { state, stateName, isLoading: stateLoading } = useAssetState(tokenId);
  const { data: tagHash } = useTagByToken(tokenId);
  const {
    stateChanges,
    transfers,
    isLoading: historyLoading,
    refetch: refetchHistory,
  } = useAssetHistory(chainId, tokenId);

  // Write hooks
  const activateHook = useActivate();
  const flagHook = useFlag();
  const recycleHook = useRecycle();

  // Modal state
  const [bindModalOpen, setBindModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);

  const isLoading = assetLoading || stateLoading;
  const hasAsset = asset && asset.owner !== "0x0000000000000000000000000000000000000000";

  // Convert blockchain timestamp (seconds) to milliseconds for display
  const timestampMs = asset ? Number(asset.timestamp) * 1000 : 0;

  // Contract address from chain config
  const coreAddress = getContractsForChain(chainId).TAGITCore;

  // Refetch everything after a successful transaction
  const handleTxSuccess = () => {
    refetch();
    refetchHistory();
  };

  // Refetch on successful activate/flag/recycle
  useEffect(() => {
    if (activateHook.isSuccess || flagHook.isSuccess || recycleHook.isSuccess) {
      handleTxSuccess();
    }
  }, [activateHook.isSuccess, flagHook.isSuccess, recycleHook.isSuccess]);

  // Determine which action buttons to show, with handlers
  const renderActions = () => {
    if (!hasAsset) return null;

    const buttons: React.ReactNode[] = [];

    switch (state) {
      case AssetState.MINTED:
        buttons.push(
          <Button key="bind" onClick={() => setBindModalOpen(true)}>
            <Link2 className="h-4 w-4 mr-2" />
            Bind to Tag
          </Button>,
          <Button key="flag" variant="destructive" onClick={() => flagHook.flag(tokenId)}>
            <Flag className="h-4 w-4 mr-2" />
            Flag
          </Button>,
        );
        break;
      case AssetState.BOUND:
        buttons.push(
          <Button key="activate" onClick={() => activateHook.activate(tokenId)}>
            <Zap className="h-4 w-4 mr-2" />
            Activate
          </Button>,
          <Button key="flag" variant="destructive" onClick={() => flagHook.flag(tokenId)}>
            <Flag className="h-4 w-4 mr-2" />
            Flag
          </Button>,
        );
        break;
      case AssetState.ACTIVATED:
        buttons.push(
          <Button key="transfer" onClick={() => setTransferModalOpen(true)}>
            <ArrowRightLeft className="h-4 w-4 mr-2" />
            Transfer
          </Button>,
          <Button key="flag" variant="destructive" onClick={() => flagHook.flag(tokenId)}>
            <Flag className="h-4 w-4 mr-2" />
            Flag
          </Button>,
        );
        break;
      case AssetState.CLAIMED:
        buttons.push(
          <Button key="flag" variant="destructive" onClick={() => flagHook.flag(tokenId)}>
            <Flag className="h-4 w-4 mr-2" />
            Flag
          </Button>,
          <Button key="recycle" variant="outline" onClick={() => recycleHook.recycle(tokenId)}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Recycle
          </Button>,
        );
        break;
      case AssetState.FLAGGED:
        buttons.push(
          <Button key="resolve" asChild>
            <Link href={`/resolve/${id}`}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Resolve
            </Link>
          </Button>,
        );
        break;
    }

    return buttons;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardContent className="pt-6">
                <div className="h-32 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (assetError) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild className="mb-2">
          <Link href="/assets">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Assets
          </Link>
        </Button>
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <h2 className="text-lg font-semibold text-destructive">Error Loading Asset</h2>
              <p className="text-muted-foreground">{assetError.message}</p>
              <Button onClick={() => refetch()}>Try Again</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!hasAsset) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild className="mb-2">
          <Link href="/assets">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Assets
          </Link>
        </Button>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <h2 className="text-lg font-semibold">Asset Not Found</h2>
              <p className="text-muted-foreground">
                Asset #{id} does not exist or has not been minted yet.
              </p>
              <Button asChild>
                <Link href="/assets">View All Assets</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="ghost" asChild className="mb-2">
        <Link href="/assets">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Assets
        </Link>
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold font-mono">#{id}</h1>
            <StateBadge state={state!} />
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4" />
            <span>Owned by</span>
            <AddressBadge address={asset!.owner} chainId={chainId} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {renderActions()}
        </div>
      </div>

      {/* Transaction Status for inline actions (activate/flag/recycle) */}
      <TransactionStatus
        isPending={activateHook.isPending}
        isConfirming={activateHook.isConfirming}
        isSuccess={activateHook.isSuccess}
        error={activateHook.error}
        hash={activateHook.hash}
        chainId={chainId}
        action="Activate"
        successMessage="Asset activated successfully!"
      />
      <TransactionStatus
        isPending={flagHook.isPending}
        isConfirming={flagHook.isConfirming}
        isSuccess={flagHook.isSuccess}
        error={flagHook.error}
        hash={flagHook.hash}
        chainId={chainId}
        action="Flag"
        successMessage="Asset flagged successfully!"
      />
      <TransactionStatus
        isPending={recycleHook.isPending}
        isConfirming={recycleHook.isConfirming}
        isSuccess={recycleHook.isSuccess}
        error={recycleHook.error}
        hash={recycleHook.hash}
        chainId={chainId}
        action="Recycle"
        successMessage="Asset recycled successfully!"
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Metadata Card */}
          <Card>
            <CardHeader>
              <CardTitle>Asset Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Token ID</div>
                  <div className="font-mono">{id}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">State</div>
                  <StateBadge state={state!} />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Tag ID</div>
                  {tagHash &&
                  tagHash !== "0x0000000000000000000000000000000000000000000000000000000000000000" ? (
                    <code className="text-sm break-all">{tagHash}</code>
                  ) : (
                    <span className="text-muted-foreground">Not bound</span>
                  )}
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Metadata</div>
                  <span className="text-muted-foreground text-sm">Requires indexer</span>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Timestamp</div>
                  <div className="text-sm">
                    {timestampMs > 0 ? formatDate(timestampMs) : "—"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lifecycle Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Lifecycle Timeline</CardTitle>
              <CardDescription>History of state transitions for this asset</CardDescription>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading timeline...
                </div>
              ) : stateChanges.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  No state changes recorded yet.
                </p>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

                  {/* Timeline events */}
                  <div className="space-y-6">
                    {stateChanges.map((event, i) => (
                      <div key={`${event.txHash}-${i}`} className="relative flex gap-4 pl-10">
                        {/* Timeline dot */}
                        <div className="absolute left-2.5 w-3 h-3 rounded-full bg-primary border-2 border-background" />

                        <div className="flex-1 bg-muted/50 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <StateBadge state={event.oldState} />
                              <span className="text-muted-foreground">&rarr;</span>
                              <StateBadge state={event.newState} />
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {formatRelativeTime(event.timestamp)}
                            </span>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            {event.actor && (
                              <div className="flex items-center gap-2">
                                <User className="h-3 w-3" />
                                <AddressBadge address={event.actor} chainId={chainId} />
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <Hash className="h-3 w-3" />
                              <a
                                href={getExplorerTxUrl(chainId, event.txHash)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-primary flex items-center gap-1"
                              >
                                {shortenAddress(event.txHash, 8)}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Ownership History */}
          <Card>
            <CardHeader>
              <CardTitle>Ownership History</CardTitle>
              <CardDescription>Transfer events for this token</CardDescription>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading transfers...
                </div>
              ) : transfers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  No transfers recorded yet.
                </p>
              ) : (
                <div className="rounded-md border">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                          From
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                          To
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                          Time
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                          Tx
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {transfers.map((transfer, i) => (
                        <tr key={`${transfer.txHash}-${i}`} className="border-b last:border-0">
                          <td className="px-4 py-3">
                            <AddressBadge address={transfer.from} chainId={chainId} />
                          </td>
                          <td className="px-4 py-3">
                            <AddressBadge address={transfer.to} chainId={chainId} />
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {formatRelativeTime(transfer.timestamp)}
                          </td>
                          <td className="px-4 py-3">
                            <a
                              href={getExplorerTxUrl(chainId, transfer.txHash)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Transfers</span>
                <span className="font-medium">{transfers.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">State Changes</span>
                <span className="font-medium">{stateChanges.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Age</span>
                <span className="font-medium">{computeAgeText(timestampMs)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Contract Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contract</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-sm text-muted-foreground mb-1">TAGITCore</div>
                <AddressBadge
                  address={coreAddress}
                  chainId={chainId}
                  truncate
                />
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Network</div>
                <Badge variant="outline">OP Sepolia</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modals */}
      <BindTagModal
        open={bindModalOpen}
        onOpenChange={setBindModalOpen}
        tokenId={tokenId}
        onSuccess={() => handleTxSuccess()}
      />
      <TransferModal
        open={transferModalOpen}
        onOpenChange={setTransferModalOpen}
        tokenId={tokenId}
        onSuccess={handleTxSuccess}
      />
    </div>
  );
}
