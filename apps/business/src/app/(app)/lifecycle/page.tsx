"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAllAssets } from "@tagit/contracts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  MetricCard,
  AddressBadge,
  getStateLabel,
  cn,
} from "@tagit/ui";
import { Activity, AlertTriangle, Factory, Radio, ShoppingBag, Workflow } from "lucide-react";
import {
  AUTHORITY_MATRIX,
  PRIMARY_STATES,
  SUB_STATES,
  daysInState,
  isBottleneck,
  isStale,
  useLiveStateChanges,
  type LifecycleAsset,
} from "@/lib/lifecycle";

export default function LifecyclePage() {
  const { assets, totalSupply, isLoading } = useAllAssets({
    pageSize: 100,
    refetchInterval: 15_000,
  });
  const liveEvents = useLiveStateChanges();
  const [selectedState, setSelectedState] = useState<number>(3); // default to ACTIVATED (richest)

  const lcAssets: LifecycleAsset[] = useMemo(
    () =>
      assets.map((a) => ({
        tokenId: a.tokenId,
        state: a.state,
        timestamp: a.timestamp,
        flags: a.flags,
      })),
    [assets],
  );

  const byState = useMemo(() => {
    const map = new Map<number, LifecycleAsset[]>();
    for (const s of PRIMARY_STATES) map.set(s.id, []);
    for (const a of lcAssets) map.get(a.state)?.push(a);
    return map;
  }, [lcAssets]);

  const counts = (id: number) => byState.get(id)?.length ?? 0;
  const manufacturing = counts(1) + counts(2) + counts(3);
  const bottlenecks = useMemo(() => lcAssets.filter(isBottleneck), [lcAssets]);

  const recent = useMemo(
    () => [...lcAssets].sort((a, b) => Number(b.timestamp - a.timestamp)).slice(0, 12),
    [lcAssets],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Workflow className="h-6 w-6" />
          Lifecycle Command Center
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every product flowing through the 7-state machine on Base — live, with the full sub-state
          model and bottleneck detection.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          title="In pipeline"
          value={totalSupply}
          loading={isLoading}
          icon={<Factory className="h-5 w-5" />}
        />
        <MetricCard
          title="In manufacturing"
          value={manufacturing}
          loading={isLoading}
          icon={<Factory className="h-5 w-5" />}
        />
        <MetricCard
          title="With customers"
          value={counts(4)}
          loading={isLoading}
          icon={<ShoppingBag className="h-5 w-5" />}
        />
        <MetricCard
          title="Needs attention"
          value={bottlenecks.length}
          loading={isLoading}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
      </div>

      {/* Pipeline board */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pipeline</CardTitle>
          <CardDescription>
            Click a stage to inspect its sub-states. Cards link to the product.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {PRIMARY_STATES.map((s) => {
              const items = byState.get(s.id) ?? [];
              const active = selectedState === s.id;
              return (
                <div
                  key={s.id}
                  className={cn(
                    "flex min-w-[150px] flex-1 flex-col rounded-xl border",
                    active && "ring-1 ring-primary",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedState(s.id)}
                    className={cn(
                      "flex items-center justify-between rounded-t-xl px-3 py-2.5 text-left transition-colors",
                      active ? "bg-primary text-primary-foreground" : "hover:bg-secondary",
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <span className={cn("h-2 w-2 rounded-full", s.dot)} />
                      {s.name}
                    </span>
                    <span
                      className={cn("text-sm font-semibold", active ? "" : "text-muted-foreground")}
                    >
                      {items.length}
                    </span>
                  </button>
                  <div className="flex-1 space-y-1.5 p-2">
                    {items.length === 0 ? (
                      <p className="px-1 py-3 text-center text-xs text-muted-foreground">—</p>
                    ) : (
                      items.slice(0, 8).map((a) => {
                        const bn = isBottleneck(a);
                        return (
                          <Link
                            key={a.tokenId.toString()}
                            href={`/products/${a.tokenId.toString()}`}
                            className={cn(
                              "flex items-center justify-between rounded-lg border px-2 py-1.5 text-xs transition-colors hover:bg-secondary",
                              bn && "border-red-500/40 bg-red-500/5",
                            )}
                          >
                            <span className="font-mono font-medium">#{a.tokenId.toString()}</span>
                            <span className="flex items-center gap-1 text-muted-foreground">
                              {bn && <AlertTriangle className="h-3 w-3 text-red-500" />}
                              {daysInState(a.timestamp)}d
                            </span>
                          </Link>
                        );
                      })
                    )}
                    {items.length > 8 && (
                      <p className="px-1 text-center text-[11px] text-muted-foreground">
                        +{items.length - 8} more
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Sub-state drilldown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {PRIMARY_STATES[selectedState].name} sub-states
            </CardTitle>
            <CardDescription>
              {PRIMARY_STATES[selectedState].description} Sub-states are managed off-chain by domain
              agents.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {(SUB_STATES[selectedState] ?? []).map((sub) => (
                <div
                  key={sub.name}
                  className={cn(
                    "rounded-lg border px-3 py-2",
                    sub.kind === "fail" && "border-red-500/30 bg-red-500/5",
                    sub.kind === "hold" && "border-amber-500/30 bg-amber-500/5",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-medium">{sub.name}</span>
                    {sub.kind === "fail" && (
                      <span className="rounded bg-red-500/10 px-1.5 text-[10px] font-medium text-red-600">
                        FAIL
                      </span>
                    )}
                    {sub.kind === "hold" && (
                      <span className="rounded bg-amber-500/10 px-1.5 text-[10px] font-medium text-amber-600">
                        HOLD
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{sub.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Live activity feed */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Radio className="h-4 w-4 text-green-500" />
              Live activity
            </CardTitle>
            <CardDescription>Real-time StateChanged events + recent transitions.</CardDescription>
          </CardHeader>
          <CardContent>
            {liveEvents.length === 0 && recent.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No on-chain activity yet.
              </p>
            ) : (
              <div className="divide-y">
                {liveEvents.map((e) => (
                  <div key={e.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-[10px] font-medium text-green-600">
                        LIVE
                      </span>
                      <Link
                        href={`/products/${e.tokenId.toString()}`}
                        className="font-mono font-medium hover:underline"
                      >
                        #{e.tokenId.toString()}
                      </Link>
                      <span className="text-muted-foreground">
                        {getStateLabel(e.from)} → {getStateLabel(e.to)}
                      </span>
                    </div>
                    <AddressBadge address={e.actor} />
                  </div>
                ))}
                {recent.map((a) => (
                  <Link
                    key={a.tokenId.toString()}
                    href={`/products/${a.tokenId.toString()}`}
                    className="flex items-center justify-between py-2.5 text-sm hover:bg-secondary/40 -mx-2 px-2 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-mono font-medium">#{a.tokenId.toString()}</span>
                      <span className="text-muted-foreground">now {getStateLabel(a.state)}</span>
                      {isStale(a) && (
                        <span className="rounded bg-amber-500/10 px-1.5 text-[10px] font-medium text-amber-600">
                          STALE
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {a.timestamp > 0n
                        ? new Date(Number(a.timestamp) * 1000).toLocaleDateString()
                        : "—"}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Authority matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">State transition authority</CardTitle>
          <CardDescription>
            Which agent authority and on-chain verification each transition requires (§7.2).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-6 py-3 font-medium">Transition</th>
                <th className="px-6 py-3 font-medium">Authority required</th>
                <th className="px-6 py-3 font-medium">Verification</th>
              </tr>
            </thead>
            <tbody>
              {AUTHORITY_MATRIX.map((row) => (
                <tr key={row.transition} className="border-b last:border-0">
                  <td className="px-6 py-3 font-mono text-xs font-medium">{row.transition}</td>
                  <td className="px-6 py-3 text-muted-foreground">{row.authority}</td>
                  <td className="px-6 py-3 text-muted-foreground">{row.verification}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
