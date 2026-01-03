"use client";

export const dynamic = "force-dynamic";

import { use, useState } from "react";
import Link from "next/link";
import { RequireCapability } from "@tagit/auth";
import { useResolve, Resolution, AssetState, AssetStateNames } from "@tagit/contracts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Badge,
  Input,
  StateBadge,
  AddressBadge,
  ResolutionBadge,
  PriorityBadge,
  calculatePriority,
  formatTimeOpen,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@tagit/ui";
import {
  ArrowLeft,
  Flag,
  Shield,
  ExternalLink,
  Hash,
  User,
  Clock,
  Package,
  CheckCircle,
  AlertTriangle,
  XCircle,
  FileText,
  Link2,
  History,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  mockFlaggedAssets,
  mockResolutionHistory,
  type FlaggedAsset,
} from "@/lib/mocks/flagged-assets";

interface ResolveDetailPageProps {
  params: Promise<{ id: string }>;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Mock ownership chain
const mockOwnershipChain = [
  {
    from: "0x0000000000000000000000000000000000000000",
    to: "0xManufacturer1234567890abcdef",
    timestamp: Date.now() - 30 * 24 * 60 * 60 * 1000,
    txHash: "0xmint...abc",
  },
  {
    from: "0xManufacturer1234567890abcdef",
    to: "0xDistributor5678901234567890",
    timestamp: Date.now() - 20 * 24 * 60 * 60 * 1000,
    txHash: "0xtransfer1...def",
  },
  {
    from: "0xDistributor5678901234567890",
    to: "0xRetailer0987654321fedcba",
    timestamp: Date.now() - 10 * 24 * 60 * 60 * 1000,
    txHash: "0xtransfer2...ghi",
  },
];

// Mock verification attempts
const mockVerificationAttempts = [
  {
    timestamp: Date.now() - 5 * 24 * 60 * 60 * 1000,
    result: true,
    verifier: "0xVerifier111...",
    location: "New York, USA",
  },
  {
    timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000,
    result: false,
    verifier: "0xVerifier222...",
    location: "Los Angeles, USA",
  },
  {
    timestamp: Date.now() - 1 * 24 * 60 * 60 * 1000,
    result: false,
    verifier: "0xVerifier333...",
    location: "Chicago, USA",
  },
];

interface ResolutionModalProps {
  type: "CLEAR" | "QUARANTINE" | "DECOMMISSION";
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (notes: string) => void;
  tokenId: string;
}

function ResolutionModal({
  type,
  isOpen,
  onClose,
  onConfirm,
  tokenId,
}: ResolutionModalProps) {
  const [notes, setNotes] = useState("");
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const config = {
    CLEAR: {
      title: "Clear Asset",
      description: "Asset verified authentic. Return to previous state.",
      buttonClass: "bg-green-600 hover:bg-green-700 text-white",
      icon: CheckCircle,
      iconColor: "text-green-600",
      requireConfirm: false,
    },
    QUARANTINE: {
      title: "Quarantine Asset",
      description: "Temporary hold. Asset remains flagged for extended investigation.",
      buttonClass: "bg-yellow-600 hover:bg-yellow-700 text-white",
      icon: AlertTriangle,
      iconColor: "text-yellow-600",
      requireConfirm: false,
    },
    DECOMMISSION: {
      title: "Decommission Asset",
      description: "Permanently recycle. Asset is fraudulent or compromised.",
      buttonClass: "bg-red-600 hover:bg-red-700 text-white",
      icon: XCircle,
      iconColor: "text-red-600",
      requireConfirm: true,
    },
  };

  const c = config[type];
  const Icon = c.icon;
  const canSubmit =
    notes.length >= 20 && (!c.requireConfirm || confirmChecked);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    onConfirm(notes);
    setIsSubmitting(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${c.iconColor}`} />
            {c.title}
          </DialogTitle>
          <DialogDescription>{c.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 rounded-lg bg-muted/50 border">
            <div className="text-sm text-muted-foreground">Asset</div>
            <div className="font-mono font-medium">#{tokenId}</div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Resolution Notes{" "}
              <span className="text-muted-foreground">(min 20 characters)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Provide detailed notes about this resolution..."
              className="w-full min-h-[100px] p-3 rounded-md border bg-background resize-none"
            />
            <div className="text-xs text-muted-foreground text-right">
              {notes.length} / 20 characters minimum
            </div>
          </div>

          {c.requireConfirm && (
            <label className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <input
                type="checkbox"
                checked={confirmChecked}
                onChange={(e) => setConfirmChecked(e.target.checked)}
                className="mt-1 rounded"
              />
              <span className="text-sm text-red-600">
                I confirm this action is irreversible. The asset will be
                permanently decommissioned and cannot be recovered.
              </span>
            </label>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            className={c.buttonClass}
          >
            {isSubmitting ? "Processing..." : `Confirm ${type}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <div className="p-4 rounded-full bg-red-500/10">
        <Shield className="h-12 w-12 text-red-500" />
      </div>
      <h1 className="text-2xl font-bold">Access Denied</h1>
      <p className="text-muted-foreground text-center max-w-md">
        You need the RESOLVER capability to access the resolution flow.
      </p>
      <Link href="/dashboard">
        <Button variant="outline">Return to Dashboard</Button>
      </Link>
    </div>
  );
}

function ResolveDetailContent({ tokenId }: { tokenId: string }) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    ownership: true,
    verification: false,
    related: false,
    similar: false,
  });
  const [activeModal, setActiveModal] = useState<"CLEAR" | "QUARANTINE" | "DECOMMISSION" | null>(null);

  // Find the asset from mock data
  const asset = mockFlaggedAssets.find((a) => a.tokenId === tokenId);
  const priority = asset ? calculatePriority(asset.flaggedAt) : "LOW";

  // Get resolution history for this asset
  const assetResolutions = mockResolutionHistory.filter(
    (r) => r.tokenId === tokenId
  );

  const { resolve, isPending } = useResolve();

  const handleResolve = (type: "CLEAR" | "QUARANTINE" | "DECOMMISSION", notes: string) => {
    const resolutionValue = { CLEAR: 0, QUARANTINE: 1, DECOMMISSION: 2 }[type] as 0 | 1 | 2;
    resolve(BigInt(tokenId), resolutionValue);
    // In production, would redirect after success
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  if (!asset) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild>
          <Link href="/resolve">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Queue
          </Link>
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Asset not found in flag queue.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="ghost" asChild>
        <Link href="/resolve">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Queue
        </Link>
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold font-mono">#{tokenId}</h1>
            <StateBadge state={AssetState.FLAGGED} />
            <PriorityBadge priority={priority} />
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>Flagged {formatTimeOpen(asset.flaggedAt)} ago</span>
            </div>
            <div className="flex items-center gap-1">
              <User className="h-4 w-4" />
              <span>by</span>
              <AddressBadge
                address={asset.flaggedBy}
                showCopy={false}
                showEtherscan={false}
              />
            </div>
            <div className="flex items-center gap-1">
              <Package className="h-4 w-4" />
              <span>Was {AssetStateNames[asset.previousState as keyof typeof AssetStateNames]}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Flag Details Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flag className="h-5 w-5 text-red-500" />
                Flag Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Reason</div>
                <p className="text-sm">{asset.flagReason}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Flagger</div>
                  <AddressBadge address={asset.flaggedBy} />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Transaction</div>
                  <a
                    href={`https://optimism-sepolia.blockscout.com/tx/${asset.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <Hash className="h-3 w-3" />
                    {asset.txHash}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Flagged At</div>
                  <div className="text-sm">{formatDate(asset.flaggedAt)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Time Open</div>
                  <div className="text-sm font-mono">{formatTimeOpen(asset.flaggedAt)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Asset Summary Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Asset Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Owner</div>
                  <AddressBadge address={asset.owner} />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Tag ID</div>
                  {asset.tagId ? (
                    <code className="text-xs break-all">{asset.tagId}</code>
                  ) : (
                    <span className="text-muted-foreground">Not bound</span>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <div className="text-sm text-muted-foreground mb-1">Metadata URI</div>
                  <a
                    href={asset.metadataURI}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    {asset.metadataURI}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Investigation Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Investigation Panel
              </CardTitle>
              <CardDescription>
                Collapsible sections for detailed investigation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {/* Ownership Chain */}
              <div className="border rounded-lg">
                <button
                  onClick={() => toggleSection("ownership")}
                  className="w-full flex items-center justify-between p-4 hover:bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4" />
                    <span className="font-medium">Ownership Chain</span>
                    <Badge variant="outline">{mockOwnershipChain.length} transfers</Badge>
                  </div>
                  {expandedSections.ownership ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
                {expandedSections.ownership && (
                  <div className="p-4 pt-0 space-y-2">
                    {mockOwnershipChain.map((transfer, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 p-2 rounded bg-muted/30 text-sm"
                      >
                        <code className="text-xs">{transfer.from.slice(0, 10)}...</code>
                        <ArrowLeft className="h-3 w-3 rotate-180" />
                        <code className="text-xs">{transfer.to.slice(0, 10)}...</code>
                        <span className="text-muted-foreground ml-auto">
                          {formatDate(transfer.timestamp)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Verification Attempts */}
              <div className="border rounded-lg">
                <button
                  onClick={() => toggleSection("verification")}
                  className="w-full flex items-center justify-between p-4 hover:bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    <span className="font-medium">Verification Attempts</span>
                    <Badge variant="outline">
                      {mockVerificationAttempts.filter((v) => !v.result).length} failed
                    </Badge>
                  </div>
                  {expandedSections.verification ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
                {expandedSections.verification && (
                  <div className="p-4 pt-0 space-y-2">
                    {mockVerificationAttempts.map((attempt, i) => (
                      <div
                        key={i}
                        className={`flex items-center gap-2 p-2 rounded text-sm ${
                          attempt.result ? "bg-green-500/10" : "bg-red-500/10"
                        }`}
                      >
                        {attempt.result ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        <span>{attempt.result ? "Passed" : "Failed"}</span>
                        <span className="text-muted-foreground">at {attempt.location}</span>
                        <span className="text-muted-foreground ml-auto">
                          {formatDate(attempt.timestamp)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Related Flags */}
              <div className="border rounded-lg">
                <button
                  onClick={() => toggleSection("related")}
                  className="w-full flex items-center justify-between p-4 hover:bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <Flag className="h-4 w-4" />
                    <span className="font-medium">Related Flags</span>
                    <Badge variant="outline">2 assets</Badge>
                  </div>
                  {expandedSections.related ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
                {expandedSections.related && (
                  <div className="p-4 pt-0">
                    <p className="text-sm text-muted-foreground">
                      Other assets flagged by the same address or with similar patterns.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Resolution History */}
          {assetResolutions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Resolution History
                </CardTitle>
                <CardDescription>
                  Previous resolutions for this asset
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                          Action
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                          Resolver
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                          Notes
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                          Timestamp
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {assetResolutions.map((record, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="px-4 py-3">
                            <ResolutionBadge resolution={record.resolution} />
                          </td>
                          <td className="px-4 py-3">
                            <AddressBadge
                              address={record.resolver}
                              showCopy={false}
                              showEtherscan={false}
                            />
                          </td>
                          <td className="px-4 py-3 text-sm max-w-[200px] truncate">
                            {record.notes}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {formatDate(record.timestamp)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar - Resolution Actions */}
        <div className="space-y-6">
          <Card className="border-2 border-dashed">
            <CardHeader>
              <CardTitle>Resolution Actions</CardTitle>
              <CardDescription>
                Choose an action to resolve this flagged asset
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* CLEAR */}
              <Button
                onClick={() => setActiveModal("CLEAR")}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                disabled={isPending}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Clear
              </Button>
              <p className="text-xs text-muted-foreground">
                Asset verified authentic. Return to previous state.
              </p>

              {/* QUARANTINE */}
              <Button
                onClick={() => setActiveModal("QUARANTINE")}
                className="w-full bg-yellow-600 hover:bg-yellow-700 text-white"
                disabled={isPending}
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Quarantine
              </Button>
              <p className="text-xs text-muted-foreground">
                Temporary hold for extended investigation.
              </p>

              {/* DECOMMISSION */}
              <Button
                onClick={() => setActiveModal("DECOMMISSION")}
                variant="destructive"
                className="w-full"
                disabled={isPending}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Decommission
              </Button>
              <p className="text-xs text-muted-foreground">
                Permanently recycle. This action is irreversible.
              </p>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Asset Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Previous State</span>
                <StateBadge state={asset.previousState} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Time Open</span>
                <span className="font-mono text-sm">{formatTimeOpen(asset.flaggedAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Priority</span>
                <PriorityBadge priority={priority} showIcon={false} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Past Resolutions</span>
                <span className="font-medium">{assetResolutions.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Resolution Modals */}
      {activeModal && (
        <ResolutionModal
          type={activeModal}
          isOpen={true}
          onClose={() => setActiveModal(null)}
          onConfirm={(notes) => handleResolve(activeModal, notes)}
          tokenId={tokenId}
        />
      )}
    </div>
  );
}

export default function ResolveDetailPage({ params }: ResolveDetailPageProps) {
  const { id } = use(params);

  return (
    <RequireCapability capability="RESOLVER" fallback={<AccessDenied />}>
      <ResolveDetailContent tokenId={id} />
    </RequireCapability>
  );
}
