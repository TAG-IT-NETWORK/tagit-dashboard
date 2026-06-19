"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { formatEther } from "viem";
import { useRegisterAgent } from "@tagit/contracts";
import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  AddressBadge,
  cn,
} from "@tagit/ui";
import { Bot, Plus } from "lucide-react";
import { AGENT_STATUS_LABELS, useAgentList, useRegistrationFee } from "@/lib/agents";

function StatusPill({ status }: { status: number }) {
  const label = AGENT_STATUS_LABELS[status] ?? `Unknown (${status})`;
  const styles: Record<number, string> = {
    0: "bg-secondary text-muted-foreground",
    1: "bg-green-500/10 text-green-600",
    2: "bg-yellow-500/10 text-yellow-600",
    3: "bg-secondary text-muted-foreground line-through",
  };
  return (
    <span
      className={cn(
        "px-2.5 py-0.5 rounded-full text-xs font-medium",
        styles[status] ?? "bg-secondary",
      )}
    >
      {label}
    </span>
  );
}

function DeployDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { address } = useAccount();
  const { register, isPending, isConfirming, isSuccess, error, agentId } = useRegisterAgent();
  const { data: fee } = useRegistrationFee();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [wallet, setWallet] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setWallet(address ?? "");
    }
  }, [open, address]);

  const busy = isPending || isConfirming;
  const walletValid = /^0x[a-fA-F0-9]{40}$/.test(wallet.trim());

  const submit = () => {
    if (!walletValid || !name.trim()) return;
    const card = JSON.stringify({
      name: name.trim(),
      description: description.trim() || undefined,
      deployedBy: "TAG IT Business",
    });
    const uri = `data:application/json,${encodeURIComponent(card)}`;
    register(wallet.trim() as `0x${string}`, uri, (fee as bigint | undefined) ?? 0n);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deploy agent</DialogTitle>
          <DialogDescription>
            Registers an ERC-8004 agent identity on Base. The agent gets a soulbound on-chain ID you
            control — suspend or decommission it anytime.
          </DialogDescription>
        </DialogHeader>

        {isSuccess ? (
          <div className="py-6 text-center space-y-2">
            <div className="text-lg font-medium">Agent deployed</div>
            {agentId !== null && (
              <p className="text-sm text-muted-foreground">
                Agent ID <span className="font-mono">#{agentId.toString()}</span>
              </p>
            )}
            <Button asChild className="mt-2">
              <Link href={agentId !== null ? `/agents/${agentId.toString()}` : "/agents"}>
                View agent
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="agent-name">Agent name</Label>
                <Input
                  id="agent-name"
                  placeholder="Inventory Verification Agent"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agent-desc">What does it do? (optional)</Label>
                <Input
                  id="agent-desc"
                  placeholder="Verifies inbound stock against on-chain state"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agent-wallet">Agent wallet</Label>
                <Input
                  id="agent-wallet"
                  placeholder="0x..."
                  value={wallet}
                  onChange={(e) => setWallet(e.target.value)}
                  disabled={busy}
                />
                <p className="text-xs text-muted-foreground">
                  The address the agent signs transactions with. Defaults to your wallet.
                </p>
              </div>
              {typeof fee === "bigint" && fee > 0n && (
                <p className="text-sm text-muted-foreground">
                  Registration fee: {formatEther(fee)} ETH
                </p>
              )}
              {error && (
                <p className="text-sm text-destructive break-all">{error.message.split("\n")[0]}</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={busy || !name.trim() || !walletValid}>
                {isPending
                  ? "Confirm in wallet..."
                  : isConfirming
                    ? "Deploying..."
                    : "Deploy agent"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function AgentsPage() {
  const { address } = useAccount();
  const [mineOnly, setMineOnly] = useState(false);
  const [deployOpen, setDeployOpen] = useState(false);
  const { agents, totalAgents, isLoading, refetch } = useAgentList({ refetchInterval: 15_000 });

  useEffect(() => {
    if (!deployOpen) refetch();
  }, [deployOpen, refetch]);

  const visible = useMemo(
    () =>
      mineOnly && address
        ? agents.filter(
            (a) =>
              a.registrant.toLowerCase() === address.toLowerCase() ||
              a.wallet.toLowerCase() === address.toLowerCase(),
          )
        : agents,
    [agents, mineOnly, address],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalAgents} agents registered on Base Sepolia.
          </p>
        </div>
        <Button onClick={() => setDeployOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Deploy agent
        </Button>
      </div>

      <div role="group" aria-label="Filter agents" className="flex gap-2">
        <button
          type="button"
          aria-pressed={!mineOnly}
          onClick={() => setMineOnly(false)}
          className={cn(
            "px-3 py-1.5 rounded-full text-sm font-medium",
            !mineOnly
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-accent",
          )}
        >
          All
        </button>
        <button
          type="button"
          aria-pressed={mineOnly}
          onClick={() => setMineOnly(true)}
          className={cn(
            "px-3 py-1.5 rounded-full text-sm font-medium",
            mineOnly
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-accent",
          )}
        >
          Mine
        </button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 rounded-lg bg-secondary animate-pulse" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <Bot className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {mineOnly ? "You haven't deployed any agents yet." : "No agents registered yet."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Registered agents</caption>
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="font-medium px-6 py-3">Agent</th>
                    <th className="font-medium px-6 py-3">Wallet</th>
                    <th className="font-medium px-6 py-3">Status</th>
                    <th className="font-medium px-6 py-3 text-right">Registered</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((agent) => (
                    <tr
                      key={agent.agentId.toString()}
                      className="border-b last:border-0 hover:bg-secondary/40"
                    >
                      <td className="px-6 py-3">
                        <Link
                          href={`/agents/${agent.agentId.toString()}`}
                          className="font-mono font-medium hover:underline"
                        >
                          #{agent.agentId.toString()}
                        </Link>
                      </td>
                      <td className="px-6 py-3">
                        <AddressBadge address={agent.wallet} />
                      </td>
                      <td className="px-6 py-3">
                        <StatusPill status={agent.status} />
                      </td>
                      <td className="px-6 py-3 text-right text-muted-foreground">
                        {agent.registeredAt > 0n
                          ? new Date(Number(agent.registeredAt) * 1000).toLocaleDateString()
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <DeployDialog open={deployOpen} onOpenChange={setDeployOpen} />
    </div>
  );
}
