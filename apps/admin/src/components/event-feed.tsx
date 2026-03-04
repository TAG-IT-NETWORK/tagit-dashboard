"use client";

import Link from "next/link";
import { useChainId } from "wagmi";
import {
  useEventFeedWithFallback,
  shortenAddress,
  getExplorerTxUrl,
  type ActivityItem,
  type TransferItem,
  type FlagItem,
} from "@tagit/contracts";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  StateBadge,
} from "@tagit/ui";
import {
  Activity,
  ArrowRightLeft,
  AlertTriangle,
  ExternalLink,
  Radio,
  ArrowRight,
  Loader2,
} from "lucide-react";

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

const eventIcons = {
  state_change: <Activity className="h-4 w-4 text-blue-500" />,
  transfer: <ArrowRightLeft className="h-4 w-4 text-green-500" />,
  flag: <AlertTriangle className="h-4 w-4 text-red-500" />,
};

const eventLabels = {
  state_change: "State Change",
  transfer: "Transfer",
  flag: "Flag",
};

const sourceBadge = {
  subgraph: { label: "Subgraph", className: "bg-green-500/15 text-green-500 border-green-500/25" },
  rpc: { label: "RPC", className: "bg-blue-500/15 text-blue-500 border-blue-500/25" },
  mock: { label: "Mock", className: "bg-yellow-500/15 text-yellow-500 border-yellow-500/25" },
} as const;

export function EventFeed() {
  const chainId = useChainId();
  const { events, isLoading, source, effectiveChainId } = useEventFeedWithFallback(chainId, 15, 5000);

  const badge = sourceBadge[source];

  return (
    <div className="space-y-4">
      {/* Testnet Banner */}
      <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
        <Radio className="h-4 w-4 text-blue-500 animate-pulse" />
        <span className="text-sm font-medium text-blue-500">
          OP SEPOLIA TESTNET — LIVE FEED
        </span>
        <Badge variant="outline" className={`ml-auto text-xs gap-1 ${badge.className}`}>
          {badge.label}
        </Badge>
        <Badge variant="outline" className="text-xs gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          Auto-refresh 5s
        </Badge>
      </div>

      {/* Feed */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5" />
            Live Event Feed
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {events.length} events
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Fetching on-chain events...
              </div>
            ) : events.length > 0 ? (
              events.map((event, i) => (
                <div
                  key={`${event.txHash}-${event.type}-${i}`}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div className="flex items-center gap-3">
                    {eventIcons[event.type]}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          {eventLabels[event.type]}
                        </span>
                        <Link
                          href={`/assets/${event.tokenId}`}
                          className="font-mono text-sm font-medium hover:text-primary transition-colors"
                        >
                          #{event.tokenId}
                        </Link>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {event.type === "state_change" && (
                          <div className="flex items-center gap-1">
                            <StateBadge
                              state={(event.data as ActivityItem).oldState}
                              className="text-[10px] px-1.5 py-0"
                            />
                            <ArrowRight className="h-3 w-3" />
                            <StateBadge
                              state={(event.data as ActivityItem).newState}
                              className="text-[10px] px-1.5 py-0"
                            />
                          </div>
                        )}
                        {event.type === "transfer" && (
                          <span>
                            {shortenAddress((event.data as TransferItem).from)} →{" "}
                            {shortenAddress((event.data as TransferItem).to)}
                          </span>
                        )}
                        {event.type === "flag" && (
                          <span>
                            by {shortenAddress((event.data as FlagItem).reporter)}
                            {(event.data as FlagItem).resolved && " (resolved)"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="text-xs">{formatRelativeTime(event.timestamp)}</span>
                    <a
                      href={getExplorerTxUrl(effectiveChainId, event.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-foreground transition-colors"
                      title={event.txHash}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No events yet — waiting for on-chain activity...
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
