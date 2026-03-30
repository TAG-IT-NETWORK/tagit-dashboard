"use client";

import { useAgentActivity, type AgentActivityEvent, type AgentActivityType } from "@tagit/contracts";
import { shortenAddress, getExplorerTxUrl } from "@tagit/contracts";
import { useChainId } from "wagmi";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  Badge,
} from "@tagit/ui";
import {
  Activity,
  Bot,
  ExternalLink,
  Loader2,
  AlertCircle,
  Star,
  ShieldCheck,
  Coins,
  RefreshCw,
  Inbox,
} from "lucide-react";

// ─── Helpers ────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<
  AgentActivityType,
  { label: string; color: string; icon: typeof Activity }
> = {
  status_change: { label: "Status", color: "bg-blue-500/20 text-blue-400", icon: Bot },
  feedback: { label: "Feedback", color: "bg-yellow-500/20 text-yellow-400", icon: Star },
  validation: { label: "Validation", color: "bg-purple-500/20 text-purple-400", icon: ShieldCheck },
  reward: { label: "Reward", color: "bg-green-500/20 text-green-400", icon: Coins },
};

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

// ─── Skeleton ───────────────────────────────────────────────────────────

function ActivitySkeleton() {
  return (
    <div className="space-y-3" data-testid="activity-skeleton">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 py-2 border-b border-border last:border-0 animate-pulse"
        >
          <div className="w-6 h-6 rounded bg-muted" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-3/4 bg-muted rounded" />
            <div className="h-2.5 w-1/3 bg-muted rounded" />
          </div>
          <div className="h-5 w-16 bg-muted rounded" />
        </div>
      ))}
    </div>
  );
}

// ─── Empty State ────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center py-8 text-muted-foreground"
      data-testid="activity-empty"
    >
      <Inbox className="h-10 w-10 mb-3 opacity-50" />
      <p className="text-sm font-medium">No agent activity yet</p>
      <p className="text-xs mt-1">
        Agent events will appear here once the indexer starts tracking activity on testnet.
      </p>
    </div>
  );
}

// ─── Error State ────────────────────────────────────────────────────────

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-8 text-muted-foreground"
      data-testid="activity-error"
    >
      <AlertCircle className="h-10 w-10 mb-3 text-destructive opacity-70" />
      <p className="text-sm font-medium">Failed to load activity</p>
      <p className="text-xs mt-1 max-w-[250px] text-center">{message}</p>
      <button
        onClick={onRetry}
        className="mt-3 text-xs text-primary hover:underline flex items-center gap-1"
      >
        <RefreshCw className="h-3 w-3" /> Retry
      </button>
    </div>
  );
}

// ─── Event Row ──────────────────────────────────────────────────────────

function EventRow({
  event,
  chainId,
}: {
  event: AgentActivityEvent;
  chainId: number;
}) {
  const config = TYPE_CONFIG[event.type];
  const Icon = config.icon;

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
      <div className={`mt-0.5 rounded-md p-1.5 ${config.color}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-tight truncate">{event.description}</p>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          <span>{formatRelativeTime(event.timestamp)}</span>
          {event.txHash.startsWith("0x") && (
            <a
              href={getExplorerTxUrl(chainId, event.txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors inline-flex items-center gap-0.5"
              title="View on explorer"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
      <Badge variant="secondary" className={`text-[10px] px-1.5 py-0.5 shrink-0 ${config.color}`}>
        {config.label}
      </Badge>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────

export function AgentActivityMonitor({
  limit = 15,
  pollingInterval = 15000,
}: {
  limit?: number;
  pollingInterval?: number;
}) {
  const chainId = useChainId();
  const { events, isLoading, error, refetch, enabled } = useAgentActivity(
    limit,
    pollingInterval,
  );

  return (
    <Card data-testid="agent-activity-monitor">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Agent Activity</CardTitle>
            {enabled && events.length > 0 && (
              <Badge variant="outline" className="text-[10px]">
                {events.length} events
              </Badge>
            )}
          </div>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        <CardDescription>
          Real-time agent status changes, feedback, validations, and reward distributions
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!enabled ? (
          <EmptyState />
        ) : isLoading && events.length === 0 ? (
          <ActivitySkeleton />
        ) : error ? (
          <ErrorState message={error.message} onRetry={refetch} />
        ) : events.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-0 max-h-[400px] overflow-y-auto">
            {events.map((event) => (
              <EventRow key={event.id} event={event} chainId={chainId} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
