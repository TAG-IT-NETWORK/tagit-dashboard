"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getAddress } from "viem";
import {
  BadgeIds,
  BadgeIdNames,
  BadgeIdList,
  CapabilityIdNames,
  CapabilityIds,
  CapabilityIdList,
  CapabilityHashes,
  CapabilityNames,
  type CapabilityHash,
  type CapabilityId,
  useBadges,
  useCapabilities,
  useGrantBadge,
  useRevokeBadge,
  useGrantCapability,
  useRevokeCapability,
  getBlockscoutTxUrl,
} from "@tagit/contracts";
import { WagmiGuard } from "@/components/wagmi-guard";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@tagit/ui";
import {
  ArrowLeft,
  Shield,
  Award,
  Package,
  Clock,
  Plus,
  Minus,
  ExternalLink,
  Hash,
  User,
  Loader2,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";

interface UserDetailPageProps {
  params: { address: string };
}

// Mock data for user's assets
const mockUserAssets = Array.from({ length: 8 }, (_, i) => ({
  tokenId: String(1000 + i * 7),
  state: Math.floor(Math.random() * 6),
  createdAt: Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000,
}));

// Mock activity data
const mockActivity = [
  {
    type: "asset_received" as const,
    tokenId: "1021",
    from: "0xManufacturer...1234",
    timestamp: Date.now() - 1000 * 60 * 30,
    txHash: "0x1234...abcd",
  },
  {
    type: "badge_granted" as const,
    badgeId: BadgeIds.KYC_L2,
    granter: "0xAdmin...5678",
    timestamp: Date.now() - 1000 * 60 * 60 * 24,
    txHash: "0x5678...efgh",
  },
  {
    type: "asset_claimed" as const,
    tokenId: "1014",
    timestamp: Date.now() - 1000 * 60 * 60 * 48,
    txHash: "0x9abc...ijkl",
  },
  {
    type: "capability_granted" as const,
    capability: "MINTER",
    granter: "0xAdmin...5678",
    timestamp: Date.now() - 1000 * 60 * 60 * 72,
    txHash: "0xdef0...mnop",
  },
];

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

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getBadgeName(badgeId: number): string {
  return BadgeIdNames[badgeId as keyof typeof BadgeIdNames] ?? `Badge ${badgeId}`;
}

function getBadgeVariant(badgeId: number): "default" | "secondary" | "outline" | "destructive" {
  if (badgeId === BadgeIds.GOV_MIL || badgeId === BadgeIds.LAW_ENFORCEMENT) {
    return "destructive";
  }
  if (badgeId === BadgeIds.MANUFACTURER || badgeId === BadgeIds.RETAILER) {
    return "default";
  }
  return "secondary";
}

// Helper to get capability name from hash
function getCapabilityName(hash: CapabilityHash): string {
  return CapabilityNames[hash as keyof typeof CapabilityNames] ?? "Unknown";
}

// Simple skeleton for loading states
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className ?? ""}`} />;
}

// Grant Badge Modal
interface GrantBadgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  address: `0x${string}`;
  existingBadges: number[];
  onSuccess: () => void;
}

function GrantBadgeModal({ isOpen, onClose, address, existingBadges, onSuccess }: GrantBadgeModalProps) {
  const [selectedBadge, setSelectedBadge] = useState<number | null>(null);
  const { grantBadge, hash, isPending, isConfirming, isSuccess, error } = useGrantBadge();

  // Available badges (not already granted)
  const availableBadges = BadgeIdList.filter((b) => !existingBadges.includes(b.id));

  useEffect(() => {
    if (isSuccess) {
      onSuccess();
      setTimeout(() => {
        onClose();
        setSelectedBadge(null);
      }, 1500);
    }
  }, [isSuccess, onClose, onSuccess]);

  const handleGrant = () => {
    if (selectedBadge !== null) {
      grantBadge(address, selectedBadge);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Grant Badge
          </DialogTitle>
          <DialogDescription>
            Select a badge to grant to this user.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isSuccess ? (
            <div className="flex items-center gap-2 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium text-green-600">Badge Granted!</p>
                {hash && (
                  <a
                    href={getBlockscoutTxUrl(hash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    View transaction
                  </a>
                )}
              </div>
            </div>
          ) : (
            <>
              {availableBadges.length === 0 ? (
                <p className="text-muted-foreground">User already has all available badges.</p>
              ) : (
                <div className="grid gap-2">
                  {availableBadges.map((badge) => (
                    <button
                      key={badge.id}
                      onClick={() => setSelectedBadge(badge.id)}
                      disabled={isPending || isConfirming}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        selectedBadge === badge.id
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <Badge variant={getBadgeVariant(badge.id)}>{badge.name}</Badge>
                    </button>
                  ))}
                </div>
              )}

              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive">
                    Error: {error.message?.slice(0, 100)}
                  </p>
                </div>
              )}

              {(isPending || isConfirming) && (
                <div className="flex items-center gap-2 text-blue-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">
                    {isPending ? "Waiting for wallet..." : "Confirming transaction..."}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending || isConfirming}>
            {isSuccess ? "Close" : "Cancel"}
          </Button>
          {!isSuccess && (
            <Button
              onClick={handleGrant}
              disabled={selectedBadge === null || isPending || isConfirming}
            >
              {isPending || isConfirming ? "Processing..." : "Grant Badge"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Grant Capability Modal
interface GrantCapabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  address: `0x${string}`;
  existingCapabilities: CapabilityHash[];
  onSuccess: () => void;
}

function GrantCapabilityModal({ isOpen, onClose, address, existingCapabilities, onSuccess }: GrantCapabilityModalProps) {
  const [selectedCapabilityId, setSelectedCapabilityId] = useState<CapabilityId | null>(null);
  const { grantCapability, hash, isPending, isConfirming, isSuccess, error } = useGrantCapability();

  // Available capabilities (not already granted) - compare hashes since TAGITAccess returns bytes32
  const availableCapabilities = CapabilityIdList.filter(
    (c) => !existingCapabilities.includes(c.hash)
  );

  useEffect(() => {
    if (isSuccess) {
      onSuccess();
      setTimeout(() => {
        onClose();
        setSelectedCapabilityId(null);
      }, 1500);
    }
  }, [isSuccess, onClose, onSuccess]);

  const handleGrant = () => {
    if (selectedCapabilityId !== null) {
      grantCapability(address, selectedCapabilityId);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Grant Capability
          </DialogTitle>
          <DialogDescription>
            Select a capability to grant to this user.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isSuccess ? (
            <div className="flex items-center gap-2 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium text-green-600">Capability Granted!</p>
                {hash && (
                  <a
                    href={getBlockscoutTxUrl(hash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    View transaction
                  </a>
                )}
              </div>
            </div>
          ) : (
            <>
              {availableCapabilities.length === 0 ? (
                <p className="text-muted-foreground">User already has all available capabilities.</p>
              ) : (
                <div className="grid gap-2">
                  {availableCapabilities.map((cap) => (
                    <button
                      key={cap.key}
                      onClick={() => setSelectedCapabilityId(cap.id)}
                      disabled={isPending || isConfirming}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        selectedCapabilityId === cap.id
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <Badge variant="outline">{cap.name}</Badge>
                    </button>
                  ))}
                </div>
              )}

              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive">
                    Error: {error.message?.slice(0, 100)}
                  </p>
                </div>
              )}

              {(isPending || isConfirming) && (
                <div className="flex items-center gap-2 text-blue-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">
                    {isPending ? "Waiting for wallet..." : "Confirming transaction..."}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending || isConfirming}>
            {isSuccess ? "Close" : "Cancel"}
          </Button>
          {!isSuccess && (
            <Button
              onClick={handleGrant}
              disabled={selectedCapabilityId === null || isPending || isConfirming}
            >
              {isPending || isConfirming ? "Processing..." : "Grant Capability"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function UserDetailPage({ params }: UserDetailPageProps) {
  return (
    <WagmiGuard>
      <UserDetailContent address={params.address} />
    </WagmiGuard>
  );
}

function UserDetailContent({ address: rawAddress }: { address: string }) {
  // Normalize address to checksum format
  let normalizedAddress: `0x${string}`;
  try {
    normalizedAddress = getAddress(rawAddress) as `0x${string}`;
  } catch {
    normalizedAddress = rawAddress as `0x${string}`;
  }

  // Modal state
  const [showGrantBadgeModal, setShowGrantBadgeModal] = useState(false);
  const [showGrantCapabilityModal, setShowGrantCapabilityModal] = useState(false);

  // Revoke state
  const [revokingBadge, setRevokingBadge] = useState<number | null>(null);
  const [revokingCapability, setRevokingCapability] = useState<CapabilityHash | null>(null);

  // Live data hooks
  const {
    badges,
    badgeIds,
    isLoading: badgesLoading,
    error: badgesError,
    refetch: refetchBadges,
  } = useBadges(normalizedAddress);

  const {
    capabilities,
    isLoading: capabilitiesLoading,
    error: capabilitiesError,
    refetch: refetchCapabilities,
  } = useCapabilities(normalizedAddress);

  // Revoke hooks
  const {
    revokeBadge,
    isPending: revokeBadgePending,
    isConfirming: revokeBadgeConfirming,
    isSuccess: revokeBadgeSuccess,
    error: revokeBadgeError,
  } = useRevokeBadge();

  const {
    revokeCapability,
    isPending: revokeCapabilityPending,
    isConfirming: revokeCapabilityConfirming,
    isSuccess: revokeCapabilitySuccess,
    error: revokeCapabilityError,
  } = useRevokeCapability();

  // Handle badge revoke success
  useEffect(() => {
    if (revokeBadgeSuccess) {
      setTimeout(() => {
        refetchBadges();
        setRevokingBadge(null);
      }, 2000);
    }
  }, [revokeBadgeSuccess, refetchBadges]);

  // Handle capability revoke success
  useEffect(() => {
    if (revokeCapabilitySuccess) {
      setTimeout(() => {
        refetchCapabilities();
        setRevokingCapability(null);
      }, 2000);
    }
  }, [revokeCapabilitySuccess, refetchCapabilities]);

  const handleRevokeBadge = (badgeId: number) => {
    setRevokingBadge(badgeId);
    revokeBadge(normalizedAddress, badgeId);
  };

  const handleRevokeCapability = (capHash: CapabilityHash) => {
    const cap = CapabilityIdList.find((c) => c.hash === capHash);
    if (cap) {
      setRevokingCapability(capHash);
      revokeCapability(normalizedAddress, cap.id);
    }
  };

  const isLoading = badgesLoading || capabilitiesLoading;

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="ghost" asChild className="mb-2">
        <Link href="/users">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Users
        </Link>
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <User className="h-6 w-6 text-muted-foreground" />
            <h1 className="text-xl font-bold font-mono">{normalizedAddress}</h1>
          </div>
          <div className="flex items-center gap-2">
            <AddressBadge address={normalizedAddress} truncate={false} />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                refetchBadges();
                refetchCapabilities();
              }}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowGrantBadgeModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Grant Badge
          </Button>
          <Button variant="outline" onClick={() => setShowGrantCapabilityModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Grant Capability
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Badges Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Identity Badges
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowGrantBadgeModal(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Grant
                </Button>
              </div>
              <CardDescription>Badges held by this user</CardDescription>
            </CardHeader>
            <CardContent>
              {badgesError && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 mb-4">
                  <p className="text-sm text-destructive">Error loading badges: {badgesError.message}</p>
                </div>
              )}
              {revokeBadgeError && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 mb-4">
                  <p className="text-sm text-destructive">Revoke error: {revokeBadgeError.message?.slice(0, 100)}</p>
                </div>
              )}
              {badgesLoading ? (
                <div className="flex flex-wrap gap-2">
                  <Skeleton className="h-10 w-24" />
                  <Skeleton className="h-10 w-28" />
                  <Skeleton className="h-10 w-20" />
                </div>
              ) : badgeIds.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {badgeIds.map((badgeId) => (
                    <div
                      key={badgeId}
                      className="flex items-center gap-2 p-3 rounded-lg border bg-card"
                    >
                      <Badge variant={getBadgeVariant(badgeId)}>
                        {getBadgeName(badgeId)}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRevokeBadge(badgeId)}
                        disabled={revokingBadge !== null}
                      >
                        {revokingBadge === badgeId ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Minus className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No badges assigned</p>
              )}
            </CardContent>
          </Card>

          {/* Capabilities Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Capabilities
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowGrantCapabilityModal(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Grant
                </Button>
              </div>
              <CardDescription>Operational capabilities granted to this user</CardDescription>
            </CardHeader>
            <CardContent>
              {capabilitiesError && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 mb-4">
                  <p className="text-sm text-destructive">Error loading capabilities: {capabilitiesError.message}</p>
                </div>
              )}
              {revokeCapabilityError && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 mb-4">
                  <p className="text-sm text-destructive">Revoke error: {revokeCapabilityError.message?.slice(0, 100)}</p>
                </div>
              )}
              {capabilitiesLoading ? (
                <div className="flex flex-wrap gap-2">
                  <Skeleton className="h-10 w-24" />
                  <Skeleton className="h-10 w-28" />
                </div>
              ) : capabilities.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {capabilities.map((capHash) => (
                    <div
                      key={capHash}
                      className="flex items-center gap-2 p-3 rounded-lg border bg-card"
                    >
                      <Badge variant="outline">
                        {getCapabilityName(capHash as CapabilityHash)}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRevokeCapability(capHash as CapabilityHash)}
                        disabled={revokingCapability !== null}
                      >
                        {revokingCapability === capHash ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Minus className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No capabilities granted</p>
              )}
            </CardContent>
          </Card>

          {/* User's Assets */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Owned Assets
                </CardTitle>
                <Link href={`/assets?owner=${normalizedAddress}`}>
                  <Button variant="ghost" size="sm">
                    View All
                  </Button>
                </Link>
              </div>
              <CardDescription>Assets currently owned by this user</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                        Token ID
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                        State
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                        Created
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockUserAssets.slice(0, 5).map((asset) => (
                      <tr key={asset.tokenId} className="border-b last:border-0">
                        <td className="px-4 py-3">
                          <Link
                            href={`/assets/${asset.tokenId}`}
                            className="font-mono text-sm hover:text-primary"
                          >
                            #{asset.tokenId}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <StateBadge state={asset.state} />
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {formatRelativeTime(asset.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {mockUserAssets.length > 5 && (
                <div className="mt-2 text-center">
                  <Link href={`/assets?owner=${normalizedAddress}`}>
                    <Button variant="ghost" size="sm">
                      View all {mockUserAssets.length} assets
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recent Activity
              </CardTitle>
              <CardDescription>Recent events involving this user</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

                {/* Timeline events */}
                <div className="space-y-6">
                  {mockActivity.map((event, i) => (
                    <div key={i} className="relative flex gap-4 pl-10">
                      {/* Timeline dot */}
                      <div className="absolute left-2.5 w-3 h-3 rounded-full bg-primary border-2 border-background" />

                      <div className="flex-1 bg-muted/50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">
                            {event.type === "asset_received" && "Asset Received"}
                            {event.type === "badge_granted" && "Badge Granted"}
                            {event.type === "asset_claimed" && "Asset Claimed"}
                            {event.type === "capability_granted" && "Capability Granted"}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {formatRelativeTime(event.timestamp)}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          {event.type === "asset_received" && (
                            <>
                              <div>
                                Token{" "}
                                <Link
                                  href={`/assets/${event.tokenId}`}
                                  className="text-primary hover:underline"
                                >
                                  #{event.tokenId}
                                </Link>{" "}
                                from <code>{event.from}</code>
                              </div>
                            </>
                          )}
                          {event.type === "badge_granted" && (
                            <div>
                              <Badge variant={getBadgeVariant(event.badgeId)}>
                                {getBadgeName(event.badgeId)}
                              </Badge>{" "}
                              granted by <code>{event.granter}</code>
                            </div>
                          )}
                          {event.type === "asset_claimed" && (
                            <div>
                              Claimed token{" "}
                              <Link
                                href={`/assets/${event.tokenId}`}
                                className="text-primary hover:underline"
                              >
                                #{event.tokenId}
                              </Link>
                            </div>
                          )}
                          {event.type === "capability_granted" && (
                            <div>
                              <Badge variant="outline">{event.capability}</Badge> capability
                              granted by <code>{event.granter}</code>
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <Hash className="h-3 w-3" />
                            <a
                              href={`https://optimism-sepolia.blockscout.com/tx/${event.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-primary"
                            >
                              {event.txHash}
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
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
                <span className="text-sm text-muted-foreground">Assets Owned</span>
                <span className="font-medium">{mockUserAssets.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Identity Badges</span>
                {badgesLoading ? (
                  <Skeleton className="h-5 w-8" />
                ) : (
                  <span className="font-medium">{badgeIds.length}</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Capabilities</span>
                {capabilitiesLoading ? (
                  <Skeleton className="h-5 w-8" />
                ) : (
                  <span className="font-medium">{capabilities.length}</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">First Seen</span>
                <span className="font-medium text-muted-foreground">Requires indexer</span>
              </div>
            </CardContent>
          </Card>

          {/* KYC Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">KYC Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {badgesLoading ? (
                <>
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-full" />
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Level 1</span>
                    {badgeIds.includes(BadgeIds.KYC_L1) ? (
                      <Badge variant="secondary">Verified</Badge>
                    ) : (
                      <Badge variant="outline">Not Verified</Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Level 2</span>
                    {badgeIds.includes(BadgeIds.KYC_L2) ? (
                      <Badge variant="secondary">Verified</Badge>
                    ) : (
                      <Badge variant="outline">Not Verified</Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Level 3</span>
                    {badgeIds.includes(BadgeIds.KYC_L3) ? (
                      <Badge variant="secondary">Verified</Badge>
                    ) : (
                      <Badge variant="outline">Not Verified</Badge>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* View on Explorer */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">External Links</CardTitle>
            </CardHeader>
            <CardContent>
              <a
                href={`https://optimism-sepolia.blockscout.com/address/${normalizedAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                View on Blockscout
              </a>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Grant Modals */}
      <GrantBadgeModal
        isOpen={showGrantBadgeModal}
        onClose={() => setShowGrantBadgeModal(false)}
        address={normalizedAddress}
        existingBadges={badgeIds}
        onSuccess={() => refetchBadges()}
      />
      <GrantCapabilityModal
        isOpen={showGrantCapabilityModal}
        onClose={() => setShowGrantCapabilityModal(false)}
        address={normalizedAddress}
        existingCapabilities={capabilities as CapabilityHash[]}
        onSuccess={() => refetchCapabilities()}
      />
    </div>
  );
}
