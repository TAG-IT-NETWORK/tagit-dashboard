"use client";

import { type ReactNode, useEffect, useState } from "react";
import { useAccount, useChainId, useDisconnect } from "wagmi";
import {
  getContractsForChain,
  getAgentContractsForChain,
  getExplorerAddressUrl,
} from "@tagit/contracts";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  AddressBadge,
  cn,
} from "@tagit/ui";
import { CheckCircle2, ExternalLink, RefreshCw, XCircle } from "lucide-react";
import { useBusinessProfile, type BusinessProfile } from "@/lib/profile";
import { isBindReady, useBindReadiness } from "@/lib/bind";
import { BuyCredits } from "@/components/buy-credits";

const BUSINESS_TYPES: BusinessProfile["type"][] = [
  "manufacturer",
  "brand",
  "retailer",
  "recycler",
  "other",
];

function StatusRow({ label, ok, detail }: { label: string; ok?: boolean; detail?: ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2">
        {detail}
        {ok === undefined ? null : ok ? (
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        ) : (
          <XCircle className="h-4 w-4 text-red-500" />
        )}
      </span>
    </div>
  );
}

function BindRelayerCard() {
  const { data, loading, error, refresh } = useBindReadiness();
  const ready = isBindReady(data);
  const offline = !!error && !data?.configured;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">Bind relayer</CardTitle>
            <CardDescription>
              Readiness of the oracle relayer that binds NFC tags (MINTED → BOUND).
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                offline
                  ? "bg-secondary text-muted-foreground"
                  : ready
                    ? "bg-green-500/10 text-green-600"
                    : "bg-amber-500/10 text-amber-600",
              )}
            >
              {offline ? "Offline" : ready ? "Ready" : "Not ready"}
            </span>
            <button
              type="button"
              onClick={refresh}
              aria-label="Refresh bind status"
              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-secondary"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading && !data ? (
          <div className="h-24 animate-pulse rounded-lg bg-secondary" />
        ) : offline ? (
          <p className="text-sm text-muted-foreground">
            Bind service unreachable. Set <code>TAGIT_SERVICES_URL</code> /{" "}
            <code>TAGIT_SERVICES_API_KEY</code> and start tagit-services.
          </p>
        ) : !data?.configured ? (
          <p className="text-sm text-muted-foreground">
            Relayer not configured — set <code>SIGNER_PRIVATE_KEY</code> on the service (chain
            84532).
          </p>
        ) : (
          <div className="divide-y">
            <StatusRow
              label="Relayer"
              detail={data.relayer ? <AddressBadge address={data.relayer} /> : "—"}
            />
            <StatusRow
              label="Gas balance"
              ok={Number(data.gasEth ?? "0") > 0}
              detail={
                <span className="text-xs text-muted-foreground">
                  {Number(data.gasEth ?? 0).toFixed(4)} ETH
                </span>
              }
            />
            <StatusRow label="BINDER capability" ok={!!data.hasBinderCapability} />
            <StatusRow label="Oracle = trustedOracle" ok={!!data.oracleMatchesTrusted} />
          </div>
        )}
        {data?.configured && !ready && !offline && (
          <p className="mt-3 text-[11px] text-muted-foreground">
            To enable binding: fund the relayer, grant it BINDER via TAGITAccess, and set the
            contract&apos;s trustedOracle to the oracle key&apos;s address.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const { address } = useAccount();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { profile, save } = useBusinessProfile();

  const [name, setName] = useState("");
  const [type, setType] = useState<BusinessProfile["type"]>("manufacturer");
  const [website, setWebsite] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setType(profile.type);
      setWebsite(profile.website ?? "");
    }
  }, [profile]);

  const core = getContractsForChain(chainId);
  const agentContracts = getAgentContractsForChain(chainId);

  const keyContracts: { label: string; address: `0x${string}` }[] = [
    { label: "TAGITCore (products)", address: core.TAGITCore },
    { label: "Agent Identity (ERC-8004)", address: agentContracts.TAGITAgentIdentity },
    { label: "Agent Reputation", address: agentContracts.TAGITAgentReputation },
    { label: "Agent Validation", address: agentContracts.TAGITAgentValidation },
    { label: "Verification Escrow", address: core.VerificationEscrow },
    { label: "Treasury", address: core.TAGITTreasury },
  ];

  const submit = () => {
    if (!name.trim()) return;
    save({ name: name.trim(), type, website: website.trim() || undefined });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Workspace, wallet, and network configuration.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Business profile</CardTitle>
          <CardDescription>Display information for this workspace.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="set-name">Business name</Label>
            <Input id="set-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Business type</Label>
            <div className="flex flex-wrap gap-2">
              {BUSINESS_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={
                    type === t
                      ? "px-3 py-1.5 rounded-full text-sm font-medium capitalize bg-primary text-primary-foreground"
                      : "px-3 py-1.5 rounded-full text-sm font-medium capitalize bg-secondary text-secondary-foreground hover:bg-accent"
                  }
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="set-site">Website</Label>
            <Input
              id="set-site"
              placeholder="https://example.com"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>
          <Button onClick={submit} disabled={!name.trim()}>
            {saved ? "Saved" : "Save changes"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Wallet</CardTitle>
          <CardDescription>Your wallet is your on-chain business identity.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Connected address</span>
            {address ? <AddressBadge address={address} /> : <span>—</span>}
          </div>
          <Button variant="outline" onClick={() => disconnect()}>
            Disconnect wallet
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Network</CardTitle>
          <CardDescription>
            TAG IT Business runs exclusively on Base (Base Sepolia testnet, chain ID 84532).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y text-sm">
            {keyContracts.map(({ label, address: addr }) => (
              <div key={label} className="flex justify-between items-center py-3">
                <span className="text-muted-foreground">{label}</span>
                <a
                  href={getExplorerAddressUrl(chainId, addr)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 font-mono text-xs hover:underline"
                >
                  {`${addr.slice(0, 8)}...${addr.slice(-6)}`}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <BuyCredits />

      <BindRelayerCard />
    </div>
  );
}
