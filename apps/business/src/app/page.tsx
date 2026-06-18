"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ConnectButton,
  Input,
  Label,
} from "@tagit/ui";
import { ArrowRight, Bot, Package, ShieldCheck } from "lucide-react";
import { WagmiGuard } from "@/components/wagmi-guard";
import { useBusinessProfile, type BusinessProfile } from "@/lib/profile";

const BUSINESS_TYPES: { value: BusinessProfile["type"]; label: string }[] = [
  { value: "manufacturer", label: "Manufacturer" },
  { value: "brand", label: "Brand" },
  { value: "retailer", label: "Retailer" },
  { value: "recycler", label: "Recycler" },
  { value: "other", label: "Other" },
];

function ProfileForm() {
  const { save } = useBusinessProfile();
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState<BusinessProfile["type"]>("manufacturer");
  const [website, setWebsite] = useState("");

  const submit = () => {
    if (!name.trim()) return;
    save({ name: name.trim(), type, website: website.trim() || undefined });
    router.push("/dashboard");
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Set up your business</CardTitle>
        <CardDescription>
          This profile labels your workspace. Your wallet is your on-chain identity.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="biz-name">Business name</Label>
          <Input
            id="biz-name"
            placeholder="Acme Goods Inc."
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Business type</Label>
          <div className="flex flex-wrap gap-2">
            {BUSINESS_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                className={
                  type === t.value
                    ? "px-3 py-1.5 rounded-full text-sm font-medium bg-primary text-primary-foreground"
                    : "px-3 py-1.5 rounded-full text-sm font-medium bg-secondary text-secondary-foreground hover:bg-accent"
                }
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="biz-site">Website (optional)</Label>
          <Input
            id="biz-site"
            placeholder="https://example.com"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>
        <Button className="w-full" onClick={submit} disabled={!name.trim()}>
          Enter workspace
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

function Landing() {
  const { isConnected } = useAccount();
  const { profile, loaded } = useBusinessProfile();
  const router = useRouter();

  useEffect(() => {
    if (loaded && isConnected && profile) {
      router.replace("/dashboard");
    }
  }, [loaded, isConnected, profile, router]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between h-16 px-6 md:px-10 border-b">
        <div className="flex items-center gap-3">
          <Image src="/tagit_logo.png" alt="TAG IT Network" width={32} height={32} priority />
          <span className="font-semibold tracking-tight">TAG IT Business</span>
        </div>
        <ConnectButton />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        {isConnected ? (
          <ProfileForm />
        ) : (
          <div className="max-w-2xl text-center space-y-8">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
              Commerce, run by agents.
              <br />
              Verified by the chain.
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              Onboard your business, give every product an on-chain identity, and deploy autonomous
              AI agents that sell, verify, and protect your inventory — on Base.
            </p>
            <div className="flex justify-center">
              <ConnectButton className="h-12 px-8 text-base" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-8 text-left">
              <Card>
                <CardContent className="p-5 space-y-2">
                  <Package className="h-5 w-5" />
                  <div className="font-medium">Products on-chain</div>
                  <p className="text-sm text-muted-foreground">
                    Mint digital twins for physical goods. NFC-bound, lifecycle-tracked.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5 space-y-2">
                  <Bot className="h-5 w-5" />
                  <div className="font-medium">Autonomous agents</div>
                  <p className="text-sm text-muted-foreground">
                    Deploy ERC-8004 agents with identity, reputation, and your control.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5 space-y-2">
                  <ShieldCheck className="h-5 w-5" />
                  <div className="font-medium">Trustless verification</div>
                  <p className="text-sm text-muted-foreground">
                    Anyone — human or agent — can verify authenticity straight from Base.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>

      <footer className="h-14 border-t flex items-center justify-center text-xs text-muted-foreground">
        TAG IT Network — built on Base
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <WagmiGuard>
      <Landing />
    </WagmiGuard>
  );
}
