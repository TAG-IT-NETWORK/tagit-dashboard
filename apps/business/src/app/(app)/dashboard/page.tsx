"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { useAllAssets, AssetState } from "@tagit/contracts";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  MetricCard,
  StateBadge,
  AddressBadge,
} from "@tagit/ui";
import { Bot, CheckCircle2, GitBranch, Package, ShieldCheck } from "lucide-react";
import { useAgentList } from "@/lib/agents";
import { useBusinessProfile } from "@/lib/profile";

export default function DashboardPage() {
  const { address } = useAccount();
  const { profile } = useBusinessProfile();
  const { assets, totalSupply, isLoading: assetsLoading } = useAllAssets({ pageSize: 100 });
  const { agents, totalAgents, isLoading: agentsLoading } = useAgentList();

  const myProducts = assets.filter(
    (a) => address && a.owner.toLowerCase() === address.toLowerCase(),
  );
  const myAgents = agents.filter(
    (a) =>
      address &&
      (a.registrant.toLowerCase() === address.toLowerCase() ||
        a.wallet.toLowerCase() === address.toLowerCase()),
  );
  const activatedCount = assets.filter(
    (a) => a.state >= AssetState.ACTIVATED && a.state !== AssetState.RECYCLED,
  ).length;
  const activeAgents = agents.filter((a) => a.active).length;

  const recent = [...assets].sort((a, b) => Number(b.timestamp - a.timestamp)).slice(0, 6);

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {profile ? `Welcome, ${profile.name}` : "Dashboard"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your products and agents on Base, at a glance.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/agents">Deploy agent</Link>
          </Button>
          <Button asChild>
            <Link href="/products">Add product</Link>
          </Button>
        </div>
      </div>

      <Link
        href="/provenance"
        className="group flex items-center justify-between gap-4 rounded-xl border bg-primary text-primary-foreground px-5 py-4 transition-opacity hover:opacity-90"
      >
        <div className="flex items-center gap-3">
          <GitBranch className="h-5 w-5" />
          <div>
            <div className="font-medium">Provenance Explorer</div>
            <div className="text-sm opacity-80">
              See any product as a tree of components — run origin, recall, and carbon queries in
              one pass.
            </div>
          </div>
        </div>
        <span className="hidden sm:inline text-sm font-medium opacity-90 group-hover:opacity-100">
          Open →
        </span>
      </Link>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Network products"
          value={totalSupply}
          loading={assetsLoading}
          icon={<Package className="h-5 w-5" />}
        />
        <MetricCard
          title="Your products"
          value={myProducts.length}
          loading={assetsLoading}
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <MetricCard
          title="Network agents"
          value={totalAgents}
          loading={agentsLoading}
          icon={<Bot className="h-5 w-5" />}
        />
        <MetricCard
          title="Active agents"
          value={activeAgents}
          loading={agentsLoading}
          icon={<ShieldCheck className="h-5 w-5" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent products</CardTitle>
          </CardHeader>
          <CardContent>
            {assetsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-10 rounded-lg bg-secondary animate-pulse" />
                ))}
              </div>
            ) : recent.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No products yet. Mint your first product to get started.
              </p>
            ) : (
              <div className="divide-y">
                {recent.map((asset) => (
                  <Link
                    key={asset.tokenId.toString()}
                    href={`/products/${asset.tokenId.toString()}`}
                    className="flex items-center justify-between py-3 hover:bg-secondary/50 -mx-2 px-2 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm">#{asset.tokenId.toString()}</span>
                      <AddressBadge address={asset.owner} />
                    </div>
                    <StateBadge state={asset.state} />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your agents</CardTitle>
          </CardHeader>
          <CardContent>
            {agentsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-10 rounded-lg bg-secondary animate-pulse" />
                ))}
              </div>
            ) : myAgents.length === 0 ? (
              <div className="text-center py-6 space-y-3">
                <p className="text-sm text-muted-foreground">
                  You have no agents yet. Deploy one to automate verification, sales, and
                  protection.
                </p>
                <Button asChild variant="outline" size="sm">
                  <Link href="/agents">Go to Agents</Link>
                </Button>
              </div>
            ) : (
              <div className="divide-y">
                {myAgents.map((agent) => (
                  <Link
                    key={agent.agentId.toString()}
                    href={`/agents/${agent.agentId.toString()}`}
                    className="flex items-center justify-between py-3 hover:bg-secondary/50 -mx-2 px-2 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Bot className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono text-sm">Agent #{agent.agentId.toString()}</span>
                    </div>
                    <span
                      className={
                        agent.active
                          ? "text-xs font-medium text-green-600"
                          : "text-xs font-medium text-muted-foreground"
                      }
                    >
                      {agent.active ? "Active" : "Inactive"}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="text-sm text-muted-foreground">
        Network activity shown for the latest {Math.min(totalSupply, 100)} products on Base Sepolia.
      </div>
    </div>
  );
}
