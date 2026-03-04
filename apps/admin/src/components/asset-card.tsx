"use client";

import Link from "next/link";
import { useChainId } from "wagmi";
import {
  useAsset,
  shortenAddress,
  getExplorerAddressUrl,
  AssetState,
  AssetStateNames,
  type AssetStateType,
} from "@tagit/contracts";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  StateBadge,
  Button,
} from "@tagit/ui";
import { Package, ArrowRight, ArrowRightLeft, ExternalLink, Clock } from "lucide-react";

const LIFECYCLE_STATES: AssetStateType[] = [0, 1, 2, 3, 4, 5];

const stateHexColors: Record<number, string> = {
  0: "#6b7280",
  1: "#3b82f6",
  2: "#22c55e",
  3: "#a855f7",
  4: "#ef4444",
  5: "#f97316",
};

interface AssetCardProps {
  tokenId: bigint;
  onTransfer?: (tokenId: bigint) => void;
}

export function AssetCard({ tokenId, onTransfer }: AssetCardProps) {
  const chainId = useChainId();
  const { asset, isLoading } = useAsset(tokenId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-3">
            <div className="h-6 w-32 animate-pulse bg-muted rounded" />
            <div className="h-4 w-48 animate-pulse bg-muted rounded" />
            <div className="h-4 w-40 animate-pulse bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!asset) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">
            Asset #{tokenId.toString()} not found
          </p>
        </CardContent>
      </Card>
    );
  }

  const createdDate = new Date(Number(asset.timestamp) * 1000);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Asset #{tokenId.toString()}
          </CardTitle>
          <StateBadge state={asset.state} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Owner */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Owner</span>
          <a
            href={getExplorerAddressUrl(chainId, asset.owner)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 font-mono text-sm hover:text-primary transition-colors"
          >
            {shortenAddress(asset.owner)}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {/* Created */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Created</span>
          <span className="flex items-center gap-1 text-sm">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            {createdDate.toLocaleDateString()}
          </span>
        </div>

        {/* Lifecycle Progress */}
        <div className="pt-2 border-t border-border">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Lifecycle Progress
          </p>
          <div className="flex items-center gap-1">
            {LIFECYCLE_STATES.map((state) => {
              const isPast = state < asset.state;
              const isCurrent = state === asset.state;
              const isFuture = state > asset.state;

              return (
                <div key={state} className="flex items-center gap-1">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                    style={
                      isCurrent
                        ? { backgroundColor: stateHexColors[state], color: "white", boxShadow: `0 0 0 3px ${stateHexColors[state]}33` }
                        : isPast
                          ? { backgroundColor: `${stateHexColors[state]}33`, color: stateHexColors[state] }
                          : { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }
                    }
                    title={AssetStateNames[state as AssetStateType] ?? `State ${state}`}
                  >
                    {state}
                  </div>
                  {state < LIFECYCLE_STATES.length - 1 && (
                    <div
                      className="w-4 h-0.5"
                      style={{
                        backgroundColor: isFuture
                          ? "hsl(var(--muted))"
                          : `${stateHexColors[state]}66`,
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-muted-foreground">Minted</span>
            <span className="text-[10px] text-muted-foreground">Recycled</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-border">
          {onTransfer && asset.state === AssetState.ACTIVATED && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onTransfer(tokenId)}
            >
              <ArrowRightLeft className="h-4 w-4 mr-1" />
              Transfer
            </Button>
          )}
          <Button size="sm" variant="ghost" asChild className="ml-auto">
            <Link href={`/assets/${tokenId.toString()}`}>
              View Details
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
