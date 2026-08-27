"use client";

import { Loader2, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import { compareIntegrity } from "@/lib/catalog/logic";
import { useMetadataHash } from "@/lib/hooks/use-metadata-hash";

/**
 * On-chain integrity check: reads TAGITCore.metadataHash(tokenId) through the
 * shared wagmi instance and compares it against the jcs_hash the services
 * catalog serves for the same token (compareIntegrity — unit-tested pure
 * logic). Zero/missing hashes render as "unknown", never as a false match.
 */
export function IntegrityCheck({
  tokenId,
  servedHash,
}: {
  tokenId: string;
  servedHash: string | null;
}) {
  const { metadataHash, isLoading, error } = useMetadataHash(BigInt(tokenId));

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Reading on-chain hash…
      </div>
    );
  }

  const result = error ? "unknown" : compareIntegrity(metadataHash, servedHash);

  return (
    <div className="space-y-2">
      {result === "match" && (
        <div className="flex items-center gap-2 text-sm text-green-500">
          <ShieldCheck className="h-4 w-4" />
          On-chain hash matches the served canonical doc
        </div>
      )}
      {result === "mismatch" && (
        <div className="flex items-center gap-2 text-sm text-red-500">
          <ShieldAlert className="h-4 w-4" />
          On-chain hash does NOT match the served doc — investigate drift
        </div>
      )}
      {result === "unknown" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldQuestion className="h-4 w-4" />
          {error
            ? "On-chain read failed — integrity unknown"
            : "Not comparable yet (no anchored hash on one side)"}
        </div>
      )}
      <dl className="space-y-1 text-xs text-muted-foreground">
        <div>
          <dt className="inline font-medium">On-chain: </dt>
          <dd className="inline break-all font-mono">{metadataHash ?? "—"}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Served: </dt>
          <dd className="inline break-all font-mono">{servedHash ?? "—"}</dd>
        </div>
      </dl>
    </div>
  );
}
