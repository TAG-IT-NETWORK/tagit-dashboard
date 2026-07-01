"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, useChainId, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import type { Hex } from "viem";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@tagit/ui";
import { CheckCircle2, Coins, ExternalLink } from "lucide-react";
import {
  useBilling,
  USDC_ADDRESS,
  BILLING_TREASURY,
  TOPUP_USDC,
  BASE_SEPOLIA,
  topupPriceUnits,
} from "@/lib/billing";

const erc20TransferAbi = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

type Phase = "idle" | "paying" | "confirming" | "redeeming" | "done" | "error";

function explorerTx(hash: string): string {
  return `https://sepolia.basescan.org/tx/${hash}`;
}

/**
 * Buy-credits card (T6b) — the paid half of free-first-5, made clickable.
 *
 * The connected (SIWE-authenticated) wallet pays a fixed USDC top-up to the
 * treasury via wagmi, we wait for the transfer to confirm, then POST the tx hash
 * to /api/billing/redeem. The server verifies the on-chain Transfer and flips the
 * account to plan=usdc (unlimited). Shown on Settings; also reusable inline when a
 * bind/mint hits a 402 quota wall.
 */
export function BuyCredits({ onUnlocked }: { onUnlocked?: () => void }) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { billing, loaded, remaining, redeem } = useBilling();
  const { writeContractAsync } = useWriteContract();

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<Hex | undefined>();

  const { data: receipt } = useWaitForTransactionReceipt({ hash });

  const pay = useCallback(async () => {
    if (chainId !== BASE_SEPOLIA) {
      setError("Switch your wallet to Base Sepolia (chain 84532), then try again.");
      setPhase("error");
      return;
    }
    setError(null);
    setPhase("paying");
    try {
      const h = await writeContractAsync({
        address: USDC_ADDRESS,
        abi: erc20TransferAbi,
        functionName: "transfer",
        args: [BILLING_TREASURY, topupPriceUnits()],
        chainId: BASE_SEPOLIA,
      });
      setHash(h);
      setPhase("confirming");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(
        /insufficient|balance|funds/i.test(msg)
          ? "Not enough test USDC. Fund your wallet at faucet.circle.com, then try again."
          : /user rejected|denied/i.test(msg)
            ? "Payment cancelled."
            : `Payment failed: ${msg}`,
      );
      setPhase("error");
    }
  }, [chainId, writeContractAsync]);

  // Once the USDC transfer confirms, redeem it server-side (verify + unlock).
  useEffect(() => {
    if (phase !== "confirming" || !receipt || !hash) return;
    if (receipt.status !== "success") {
      setError("Payment transaction reverted on-chain.");
      setPhase("error");
      return;
    }
    setPhase("redeeming");
    void (async () => {
      const r = await redeem(hash);
      if (r.ok) {
        setPhase("done");
        onUnlocked?.();
      } else {
        setError(
          r.error === "billing_unconfigured"
            ? "Billing isn't configured on the server yet (treasury unset)."
            : r.error === "already_redeemed"
              ? "That payment was already redeemed."
              : `Redeem failed: ${r.error}`,
        );
        setPhase("error");
      }
    })();
  }, [phase, receipt, hash, redeem, onUnlocked]);

  const busy = phase === "paying" || phase === "confirming" || phase === "redeeming";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">Credits &amp; billing</CardTitle>
            <CardDescription>
              Your first {billing?.freeQuota ?? 5} product claims are free. After that, top up with
              USDC to keep minting and binding.
            </CardDescription>
          </div>
          {billing?.plan === "usdc" ? (
            <span className="rounded-full bg-green-500/10 px-2.5 py-0.5 text-[11px] font-medium text-green-600">
              Paid
            </span>
          ) : (
            <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              Free
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!loaded ? (
          <div className="h-16 animate-pulse rounded-lg bg-secondary" />
        ) : !isConnected || !billing ? (
          <p className="text-sm text-muted-foreground">
            Sign in with your wallet to see your plan and buy credits.
          </p>
        ) : billing.plan === "usdc" || phase === "done" ? (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            Paid plan active — unlimited claims.
          </div>
        ) : (
          <>
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Free claims remaining</span>
              <span className="text-sm font-medium">
                {remaining ?? 0} of {billing.freeQuota}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{
                  width: `${Math.round(((remaining ?? 0) / Math.max(1, billing.freeQuota)) * 100)}%`,
                }}
              />
            </div>
            <Button className="w-full" onClick={pay} disabled={busy}>
              <Coins className="mr-2 h-4 w-4" />
              {phase === "paying"
                ? "Confirm in your wallet…"
                : phase === "confirming"
                  ? "Waiting for confirmation…"
                  : phase === "redeeming"
                    ? "Unlocking…"
                    : `Buy credits · ${TOPUP_USDC} USDC`}
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              Pays {TOPUP_USDC} test USDC on Base Sepolia ·{" "}
              <a
                href="https://faucet.circle.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                need test USDC?
              </a>
            </p>
          </>
        )}

        {hash && (phase === "confirming" || phase === "done") && (
          <a
            href={explorerTx(hash)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground hover:underline"
          >
            payment tx <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {phase === "error" && error && <p className="text-sm text-red-500">{error}</p>}
      </CardContent>
    </Card>
  );
}
