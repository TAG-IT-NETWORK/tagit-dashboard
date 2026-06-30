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
import { ArrowRight } from "lucide-react";
import { WagmiGuard } from "@/components/wagmi-guard";
import { MarketingLanding } from "@/components/marketing-landing";
import { SignIn } from "@/components/sign-in";
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

/** Minimal chrome for the connected onboarding (profile) step. */
function OnboardingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between h-16 px-6 md:px-10 border-b">
        <div className="flex items-center gap-3">
          <Image src="/tagit_logo.png" alt="TAG IT Network" width={32} height={32} priority />
          <span className="font-semibold tracking-tight">TAG IT Business</span>
        </div>
        <ConnectButton />
      </header>
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">{children}</main>
      <footer className="h-14 border-t flex items-center justify-center text-xs text-muted-foreground">
        TAG IT Network — built on Base
      </footer>
    </div>
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

  // Disconnected visitors see the full public marketing/explainer funnel.
  if (!isConnected) {
    return <MarketingLanding />;
  }

  // Connected: sign in (SIWE → server session), then the business-profile step.
  return (
    <OnboardingShell>
      <Onboarding />
    </OnboardingShell>
  );
}

/** SIWE sign-in establishes the server session; ProfileForm then completes onboarding. */
function Onboarding() {
  const [signedIn, setSignedIn] = useState(false);
  if (!signedIn) return <SignIn onSignedIn={() => setSignedIn(true)} />;
  return <ProfileForm />;
}

export default function Home() {
  return (
    <WagmiGuard>
      <Landing />
    </WagmiGuard>
  );
}
