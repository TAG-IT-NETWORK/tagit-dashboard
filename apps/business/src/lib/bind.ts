"use client";

import { useCallback, useState } from "react";

export interface BindRelayResult {
  ok: boolean;
  tokenId?: string;
  tagHash?: string;
  state?: number;
  txHash?: string;
  explorerUrl?: string;
  alreadyBound?: boolean;
  error?: string;
}

/**
 * Bind a tag via the oracle relayer (POST /api/bind → tagit-services).
 * The relayer signs the oracle attestation and submits bindTag on-chain; the
 * user's wallet signs nothing here.
 */
export function useBindViaRelayer() {
  const [isPending, setIsPending] = useState(false);
  const [result, setResult] = useState<BindRelayResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bind = useCallback(async (tokenId: bigint, tagUid: string): Promise<BindRelayResult> => {
    setIsPending(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/bind", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tokenId: tokenId.toString(), tagUid }),
      });
      const data = (await res.json()) as BindRelayResult;
      if (!res.ok || !data.ok) {
        setError(data.error ?? `bind failed (${res.status})`);
      } else {
        setResult(data);
      }
      return data;
    } catch (e) {
      const message = e instanceof Error ? e.message : "bind request failed";
      setError(message);
      return { ok: false, error: message };
    } finally {
      setIsPending(false);
    }
  }, []);

  return { bind, isPending, result, error };
}
