"use client";

import { useCallback, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { createSiweMessage } from "viem/siwe";

interface NonceResp {
  ok: boolean;
  nonce: string;
  domain: string;
  chainId: number;
}

export interface VerifyResp {
  ok: boolean;
  role?: string;
  onboarded?: boolean;
  account?: { id: string; name: string; type: string; plan: string };
  error?: string;
}

type Status = "idle" | "signing" | "verifying" | "success" | "error";

/**
 * SIWE sign-in for the connected wallet (works for an external wallet OR a Privy
 * embedded wallet — both expose wagmi's signer). Flow: get a single-use nonce from
 * the services tier (via the same-origin /api/auth proxy), build an EIP-4361 message,
 * sign it, POST to /verify. On success the services tier sets the HttpOnly session
 * cookie (relayed by the proxy).
 */
export function useSiweLogin() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (): Promise<VerifyResp | null> => {
    if (!isConnected || !address) {
      setStatus("error");
      setError("Connect a wallet first");
      return null;
    }
    try {
      setStatus("signing");
      setError(null);

      const nonceRes = await fetch("/api/auth/nonce", { method: "POST" });
      const nonce = (await nonceRes.json()) as NonceResp;
      if (!nonceRes.ok || !nonce?.ok) throw new Error("Could not start sign-in");

      const message = createSiweMessage({
        address,
        chainId: nonce.chainId,
        domain: nonce.domain,
        nonce: nonce.nonce,
        uri: typeof window !== "undefined" ? window.location.origin : `https://${nonce.domain}`,
        version: "1",
        statement: "Sign in to TAG IT Business.",
        issuedAt: new Date(),
      });

      const signature = await signMessageAsync({ message });

      setStatus("verifying");
      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, signature }),
      });
      const data = (await verifyRes.json()) as VerifyResp;
      if (!verifyRes.ok || !data.ok) throw new Error(data?.error ?? "Sign-in failed");

      setStatus("success");
      return data;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sign-in failed";
      setStatus("error");
      setError(/reject|denied|user denied/i.test(msg) ? "Signature rejected" : msg);
      return null;
    }
  }, [address, isConnected, signMessageAsync]);

  return { status, error, login };
}
