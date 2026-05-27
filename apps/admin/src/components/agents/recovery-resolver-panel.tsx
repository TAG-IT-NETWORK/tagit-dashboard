"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  Badge,
  Button,
  Input,
  AddressBadge,
} from "@tagit/ui";
import {
  Bot,
  ShieldCheck,
  ShieldAlert,
  Pause,
  Play,
  RefreshCw,
  ExternalLink,
  CheckCircle,
  MinusCircle,
  XCircle,
  Fuel,
} from "lucide-react";

const SERVICES_URL = process.env.NEXT_PUBLIC_SERVICES_URL ?? "http://localhost:3100";
const BASE = `${SERVICES_URL}/api/v1/recovery`;
// Skip the ngrok-free browser interstitial when the services API is tunneled.
const SERVICES_HEADERS = { "ngrok-skip-browser-warning": "true" };

interface Status {
  agentId: number;
  address: string;
  paused: boolean;
  maxRisk: number;
  pollMs: number;
  chainId: number;
  claims: number;
  decisions: number;
  gasEth: string;
  hasResolverCapability: boolean;
}
interface Claim {
  tokenId: string;
  rightfulOwner: string;
  reason: string;
  submittedAt: number;
}
interface Decision {
  ts: number;
  tokenId: string;
  rightfulOwner: string;
  riskScore: number | null;
  action: "approved" | "abstained" | "skipped";
  reason: string;
  explorerUrl?: string;
}

const actionStyle: Record<Decision["action"], { icon: typeof CheckCircle; cls: string }> = {
  approved: { icon: CheckCircle, cls: "text-green-600" },
  abstained: { icon: MinusCircle, cls: "text-amber-500" },
  skipped: { icon: XCircle, cls: "text-muted-foreground" },
};

export function RecoveryResolverPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false);

  // claim form
  const [tokenId, setTokenId] = useState("");
  const [rightfulOwner, setRightfulOwner] = useState("");
  const [reason, setReason] = useState("");
  // risk form
  const [riskInput, setRiskInput] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [s, c, d] = await Promise.all([
        fetch(`${BASE}/status`, { headers: SERVICES_HEADERS }).then((r) =>
          r.ok ? r.json() : null,
        ),
        fetch(`${BASE}/claims`, { headers: SERVICES_HEADERS }).then((r) =>
          r.ok ? r.json() : { claims: [] },
        ),
        fetch(`${BASE}/decisions`, { headers: SERVICES_HEADERS }).then((r) =>
          r.ok ? r.json() : { decisions: [] },
        ),
      ]);
      if (!s) {
        setOffline(true);
        return;
      }
      setOffline(false);
      setStatus(s);
      setClaims(c.claims ?? []);
      setDecisions(d.decisions ?? []);
    } catch {
      setOffline(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 8000);
    return () => clearInterval(t);
  }, [refresh]);

  const post = async (path: string, body?: unknown) => {
    setBusy(true);
    try {
      await fetch(`${BASE}${path}`, {
        method: "POST",
        headers: body
          ? { "Content-Type": "application/json", ...SERVICES_HEADERS }
          : { ...SERVICES_HEADERS },
        body: body ? JSON.stringify(body) : undefined,
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const validClaim =
    /^\d+$/.test(tokenId) && /^0x[0-9a-fA-F]{40}$/.test(rightfulOwner) && reason.length >= 3;

  if (offline) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-violet-500" />
            Recovery Resolver Agent
          </CardTitle>
          <CardDescription>
            Agent service offline. Start it with{" "}
            <code className="text-xs">cd tagit-services &amp;&amp; npm run dev</code> (port 3100).
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-violet-500/30">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-violet-500" />
              Recovery Resolver Agent
              {status?.paused ? (
                <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">paused</Badge>
              ) : (
                <Badge className="bg-green-500/15 text-green-600 border-green-500/30">active</Badge>
              )}
            </CardTitle>
            <CardDescription>
              ERC-8004 agent #{status?.agentId} — auto-casts approval #1 of the 2-of-3 resolve
              quorum (human-on-the-loop)
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={busy} onClick={() => post("/poll")}>
              <RefreshCw className="h-4 w-4 mr-1" /> Poll now
            </Button>
            {status?.paused ? (
              <Button
                size="sm"
                disabled={busy}
                onClick={() => post("/control", { action: "resume" })}
              >
                <Play className="h-4 w-4 mr-1" /> Resume
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => post("/control", { action: "pause" })}
              >
                <Pause className="h-4 w-4 mr-1" /> Pause
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Status row */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div>
            <div className="text-muted-foreground text-xs">Agent wallet</div>
            {status && <AddressBadge address={status.address} chainId={status.chainId} showCopy />}
          </div>
          <div>
            <div className="text-muted-foreground text-xs">RESOLVER capability</div>
            {status?.hasResolverCapability ? (
              <span className="flex items-center gap-1 text-green-600">
                <ShieldCheck className="h-4 w-4" /> granted
              </span>
            ) : (
              <span className="flex items-center gap-1 text-destructive">
                <ShieldAlert className="h-4 w-4" /> missing
              </span>
            )}
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Gas</div>
            <span className="flex items-center gap-1 font-mono">
              <Fuel className="h-4 w-4" /> {Number(status?.gasEth ?? 0).toFixed(4)} ETH
            </span>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Poll interval</div>
            <span className="font-mono">{Math.round((status?.pollMs ?? 0) / 1000)}s</span>
          </div>
        </div>

        {/* Controls: risk threshold + submit claim */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
            <div className="text-sm font-medium">Fraud-risk tolerance</div>
            <p className="text-xs text-muted-foreground">
              Agent approves only when assessed risk ≤ this. Current:{" "}
              <span className="font-mono">{status?.maxRisk}</span>/100
            </p>
            <div className="flex gap-2">
              <Input
                type="number"
                min={0}
                max={100}
                placeholder={`${status?.maxRisk ?? 60}`}
                value={riskInput}
                onChange={(e) => setRiskInput(e.target.value)}
                className="w-24"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={busy || riskInput === ""}
                onClick={() =>
                  post("/config", { maxRisk: Number(riskInput) }).then(() => setRiskInput(""))
                }
              >
                Save
              </Button>
            </div>
          </div>

          <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
            <div className="text-sm font-medium">Submit recovery claim</div>
            <div className="flex gap-2">
              <Input
                placeholder="token ID"
                value={tokenId}
                onChange={(e) => setTokenId(e.target.value)}
                className="w-24"
              />
              <Input
                placeholder="rightful owner 0x…"
                value={rightfulOwner}
                onChange={(e) => setRightfulOwner(e.target.value)}
                className="font-mono flex-1"
              />
            </div>
            <Input
              placeholder="reason (≥3 chars)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <Button
              size="sm"
              disabled={busy || !validClaim}
              onClick={() =>
                post("/claims", { tokenId, rightfulOwner, reason }).then(() => {
                  setTokenId("");
                  setRightfulOwner("");
                  setReason("");
                })
              }
            >
              Queue claim for agent
            </Button>
          </div>
        </div>

        {/* Open claims */}
        {claims.length > 0 && (
          <div>
            <div className="text-sm font-medium mb-1">Open claims ({claims.length})</div>
            <div className="space-y-1">
              {claims.map((c) => (
                <div
                  key={c.tokenId}
                  className="flex items-center gap-2 text-sm p-2 rounded bg-muted/30"
                >
                  <Badge variant="outline">#{c.tokenId}</Badge>
                  <span className="text-muted-foreground">→</span>
                  <AddressBadge address={c.rightfulOwner} showCopy={false} showEtherscan={false} />
                  <span className="text-xs text-muted-foreground truncate ml-auto">{c.reason}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Decision feed */}
        <div>
          <div className="text-sm font-medium mb-1">Agent activity ({decisions.length})</div>
          {decisions.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No decisions yet. Submit a claim for a flagged asset.
            </p>
          ) : (
            <div className="space-y-1 max-h-64 overflow-auto">
              {decisions.map((d, i) => {
                const { icon: Icon, cls } = actionStyle[d.action];
                return (
                  <div
                    key={`${d.tokenId}-${d.ts}-${i}`}
                    className="flex items-start gap-2 text-sm p-2 rounded bg-muted/30"
                  >
                    <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${cls}`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium capitalize ${cls}`}>{d.action}</span>
                        <Badge variant="outline">#{d.tokenId}</Badge>
                        {d.riskScore !== null && (
                          <span className="text-xs text-muted-foreground">
                            risk {d.riskScore}/100
                          </span>
                        )}
                        {d.explorerUrl && (
                          <a
                            href={d.explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline inline-flex items-center gap-0.5 text-xs"
                          >
                            tx <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{d.reason}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                      {new Date(d.ts).toLocaleTimeString()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
