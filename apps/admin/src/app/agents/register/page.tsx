"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useAccount, useChainId, useReadContract } from "wagmi";
import Link from "next/link";
import {
  useRegisterAgent,
  getAgentContractsForChain,
  TAGITAgentIdentityABI,
} from "@tagit/contracts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Input,
  useToast,
} from "@tagit/ui";
import { TransactionStatus } from "@/components/transaction-status";
import { ArrowLeft, Bot, Wallet, Link2, CheckCircle2, Loader2 } from "lucide-react";

// ── Helpers ────────────────────────────────────────────────────────────────────

function isValidAddress(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function isValidUri(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "ipfs:";
  } catch {
    return false;
  }
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function RegisterAgentPage() {
  const { address: connectedAddress } = useAccount();
  const chainId = useChainId();
  const { toast } = useToast();

  const [walletAddress, setWalletAddress] = useState("");
  const [agentUri, setAgentUri] = useState("");

  // Populate wallet from connected account
  const handleUseMyAddress = () => {
    if (connectedAddress) {
      setWalletAddress(connectedAddress);
    }
  };

  // Read registration fee from contract
  let contracts: ReturnType<typeof getAgentContractsForChain> | null = null;
  try {
    contracts = getAgentContractsForChain(chainId);
  } catch {
    contracts = null;
  }

  const { data: registrationFee, isLoading: isFeeLoading } = useReadContract(
    contracts
      ? {
          address: contracts.TAGITAgentIdentity,
          abi: TAGITAgentIdentityABI,
          functionName: "registrationFee",
          chainId,
        }
      : undefined,
  );

  const feeEth =
    registrationFee !== undefined
      ? registrationFee === 0n
        ? "Free"
        : `${(Number(registrationFee) / 1e18).toFixed(6)} ETH`
      : null;

  // Write hook
  const { register, hash, isPending, isConfirming, isSuccess, error, agentId } = useRegisterAgent();

  // Success side-effect: toast
  useEffect(() => {
    if (isSuccess && agentId !== null) {
      toast({
        title: "Agent registered",
        description: `Agent #${agentId.toString()} is now on-chain.`,
        variant: "success",
      });
    }
  }, [isSuccess, agentId, toast]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidAddress(walletAddress) || !isValidUri(agentUri)) return;
    register(walletAddress as `0x${string}`, agentUri, registrationFee ?? 0n);
  };

  const walletError =
    walletAddress.length > 0 && !isValidAddress(walletAddress)
      ? "Enter a valid 0x Ethereum address"
      : null;

  const uriError =
    agentUri.length > 0 && !isValidUri(agentUri) ? "Enter a valid https:// or ipfs:// URI" : null;

  const canSubmit =
    isValidAddress(walletAddress) &&
    isValidUri(agentUri) &&
    !isPending &&
    !isConfirming &&
    !isSuccess;

  return (
    <div className="max-w-xl space-y-6">
      {/* Back link */}
      <div>
        <Link
          href="/agents"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Agents
        </Link>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bot className="h-6 w-6" />
          Register New Agent
        </h1>
        <p className="text-muted-foreground mt-1">
          Register an AI agent on-chain with an identity and URI endpoint.
        </p>
      </div>

      {/* Success state */}
      {isSuccess && agentId !== null && (
        <Card className="border-green-500/50 bg-green-500/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
              <div className="space-y-2">
                <p className="font-medium text-green-600">Agent registered successfully</p>
                <p className="text-sm text-muted-foreground">
                  Agent ID assigned:{" "}
                  <span className="font-mono font-bold">#{agentId.toString()}</span>
                </p>
                <Link
                  href={`/agents/${agentId.toString()}`}
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  View agent #{agentId.toString()}
                  <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Agent Details</CardTitle>
          <CardDescription>
            Provide the agent wallet address and its A2A endpoint URI.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Wallet address */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5" />
                Agent Wallet Address
              </label>
              <div className="flex gap-2">
                <Input
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  placeholder="0x..."
                  className="font-mono"
                  disabled={isPending || isConfirming}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleUseMyAddress}
                  disabled={!connectedAddress || isPending || isConfirming}
                  className="shrink-0"
                >
                  Use My Address
                </Button>
              </div>
              {walletError && <p className="text-xs text-destructive">{walletError}</p>}
              {!connectedAddress && (
                <p className="text-xs text-muted-foreground">Connect wallet to use your address.</p>
              )}
            </div>

            {/* Agent URI */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5" />
                Agent URI
              </label>
              <Input
                value={agentUri}
                onChange={(e) => setAgentUri(e.target.value)}
                placeholder="https://tagit.network/agents/my-agent"
                disabled={isPending || isConfirming}
              />
              {uriError && <p className="text-xs text-destructive">{uriError}</p>}
              <p className="text-xs text-muted-foreground">
                Examples: <code className="text-xs">https://tagit.network/agents/my-agent</code>
                {" or "}
                <code className="text-xs">ipfs://Qm...</code>
              </p>
            </div>

            {/* Registration fee */}
            <div className="rounded-lg border p-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Registration fee</span>
              {isFeeLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <span className="font-mono font-medium">{feeEth ?? "—"}</span>
              )}
            </div>

            {/* Submit */}
            <Button type="submit" disabled={!canSubmit} className="w-full">
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Confirm in wallet...
                </>
              ) : isConfirming ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Registering on-chain...
                </>
              ) : (
                <>
                  <Bot className="h-4 w-4 mr-2" />
                  Register Agent
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Transaction status */}
      <TransactionStatus
        isPending={isPending}
        isConfirming={isConfirming}
        isSuccess={isSuccess}
        error={error}
        hash={hash}
        chainId={chainId}
        action="register agent"
        successMessage={
          agentId !== null
            ? `Agent #${agentId.toString()} registered successfully.`
            : "Agent registered successfully."
        }
      />
    </div>
  );
}
