"use client";

import { useEffect, useState } from "react";
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
} from "@tagit/ui";
import { ExternalLink } from "lucide-react";
import { useBusinessProfile, type BusinessProfile } from "@/lib/profile";

const BUSINESS_TYPES: BusinessProfile["type"][] = [
  "manufacturer",
  "brand",
  "retailer",
  "recycler",
  "other",
];

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
    </div>
  );
}
