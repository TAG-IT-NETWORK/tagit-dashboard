"use client";

import { use } from "react";
import Link from "next/link";
import { useAsset, useAssetState, AssetState, AssetStateNames } from "@tagit/contracts";
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
  FileText,
  CheckCircle,
} from "lucide-react";

// Mock data for timeline - in production, fetch from events
interface TimelineEvent {
  state: number;
  stateName: string;
  timestamp: number;
  txHash: string;
  actor: string;
}

const mockTimeline: TimelineEvent[] = [
  {
    state: 0,
    stateName: "Minted",
    timestamp: Date.now() - 7 * 24 * 60 * 60 * 1000,
    txHash: "0x1234...abcd",
    actor: "0xManufacturer...1234",
  },
  {
    state: 1,
    stateName: "Bound",
    timestamp: Date.now() - 5 * 24 * 60 * 60 * 1000,
    txHash: "0x5678...efgh",
    actor: "0xManufacturer...1234",
  },
  {
    state: 2,
    stateName: "Activated",
    timestamp: Date.now() - 3 * 24 * 60 * 60 * 1000,
    txHash: "0x9abc...ijkl",
    actor: "0xRetailer...5678",
  },
];

const mockTransfers = [
  {
    from: "0x0000...0000",
    to: "0xManufacturer...1234",
    timestamp: Date.now() - 7 * 24 * 60 * 60 * 1000,
    txHash: "0x1234...abcd",
  },
  {
    from: "0xManufacturer...1234",
    to: "0xRetailer...5678",
    timestamp: Date.now() - 3 * 24 * 60 * 60 * 1000,
    txHash: "0x9abc...ijkl",
  },
];

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

interface AssetDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function AssetDetailPage({ params }: AssetDetailPageProps) {
  const { id } = use(params);
  const tokenId = BigInt(id);

  const { asset, isLoading: assetLoading, error: assetError } = useAsset(tokenId);
  const { state, stateName, isLoading: stateLoading } = useAssetState(tokenId);

  // Mock data for demonstration
  const mockAsset = {
    id: tokenId,
    owner: "0x1234567890abcdef1234567890abcdef12345678" as `0x${string}`,
    state: 2,
    tagId: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" as `0x${string}`,
    metadataURI: "ipfs://QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
    createdAt: BigInt(Date.now() - 7 * 24 * 60 * 60 * 1000),
    updatedAt: BigInt(Date.now() - 3 * 24 * 60 * 60 * 1000),
  };

  const displayAsset = asset ?? mockAsset;
  const displayState = state ?? mockAsset.state;
  const displayStateName = stateName ?? AssetStateNames[mockAsset.state as keyof typeof AssetStateNames];
  const isLoading = assetLoading || stateLoading;

  // Actions based on state
  const getActions = () => {
    switch (displayState) {
      case AssetState.MINTED:
        return [
          { label: "Bind to Tag", icon: Link2, variant: "default" as const },
          { label: "Flag", icon: Flag, variant: "destructive" as const },
        ];
      case AssetState.BOUND:
        return [
          { label: "Activate", icon: Zap, variant: "default" as const },
          { label: "Flag", icon: Flag, variant: "destructive" as const },
        ];
      case AssetState.ACTIVATED:
        return [{ label: "Flag", icon: Flag, variant: "destructive" as const }];
      case AssetState.CLAIMED:
        return [
          { label: "Flag", icon: Flag, variant: "destructive" as const },
          { label: "Recycle", icon: RotateCcw, variant: "outline" as const },
        ];
      case AssetState.FLAGGED:
        return [
          {
            label: "Resolve",
            icon: CheckCircle,
            variant: "default" as const,
            href: `/resolve/${id}`,
          },
        ];
      default:
        return [];
    }
  };

  const actions = getActions();

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
            <StateBadge state={displayState} />
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4" />
            <span>Owned by</span>
            <AddressBadge address={displayAsset.owner} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {actions.map((action) =>
            "href" in action ? (
              <Button key={action.label} variant={action.variant} asChild>
                <Link href={action.href!}>
                  <action.icon className="h-4 w-4 mr-2" />
                  {action.label}
                </Link>
              </Button>
            ) : (
              <Button key={action.label} variant={action.variant}>
                <action.icon className="h-4 w-4 mr-2" />
                {action.label}
              </Button>
            )
          )}
        </div>
      </div>

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
                  <StateBadge state={displayState} />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Tag ID</div>
                  {displayAsset.tagId &&
                  displayAsset.tagId !== "0x0000000000000000000000000000000000000000000000000000000000000000" ? (
                    <code className="text-sm break-all">{displayAsset.tagId}</code>
                  ) : (
                    <span className="text-muted-foreground">Not bound</span>
                  )}
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Metadata URI</div>
                  <a
                    href={displayAsset.metadataURI}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    {displayAsset.metadataURI.slice(0, 30)}...
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Created</div>
                  <div className="text-sm">
                    {formatDate(Number(displayAsset.createdAt))}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Last Updated</div>
                  <div className="text-sm">
                    {formatDate(Number(displayAsset.updatedAt))}
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
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

                {/* Timeline events */}
                <div className="space-y-6">
                  {mockTimeline.map((event, i) => (
                    <div key={i} className="relative flex gap-4 pl-10">
                      {/* Timeline dot */}
                      <div className="absolute left-2.5 w-3 h-3 rounded-full bg-primary border-2 border-background" />

                      <div className="flex-1 bg-muted/50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <StateBadge state={event.state} />
                          <span className="text-sm text-muted-foreground">
                            {formatRelativeTime(event.timestamp)}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <div className="flex items-center gap-2">
                            <User className="h-3 w-3" />
                            <code>{event.actor}</code>
                          </div>
                          <div className="flex items-center gap-2">
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

          {/* Ownership History */}
          <Card>
            <CardHeader>
              <CardTitle>Ownership History</CardTitle>
              <CardDescription>Transfer events for this token</CardDescription>
            </CardHeader>
            <CardContent>
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
                    {mockTransfers.map((transfer, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-4 py-3">
                          <code className="text-sm">{transfer.from}</code>
                        </td>
                        <td className="px-4 py-3">
                          <code className="text-sm">{transfer.to}</code>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {formatRelativeTime(transfer.timestamp)}
                        </td>
                        <td className="px-4 py-3">
                          <a
                            href={`https://optimism-sepolia.blockscout.com/tx/${transfer.txHash}`}
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
                <span className="font-medium">{mockTransfers.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">State Changes</span>
                <span className="font-medium">{mockTimeline.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Age</span>
                <span className="font-medium">7 days</span>
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
                  address="0x6a58eE8f2d500981b1793868C55072789c58fba6"
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
    </div>
  );
}
