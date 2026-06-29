"use client";

import { useState } from "react";
import Image from "next/image";
import { Button, Card, CardContent, ConnectButton, Input, Label } from "@tagit/ui";
import {
  ArrowRight,
  Bot,
  Check,
  FileCheck,
  GitBranch,
  LifeBuoy,
  Package,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

/**
 * Public, non-wallet-gated marketing + explainer surface for pro.tagit.network.
 * Shown to disconnected visitors. All CTAs resolve on-page (anchors / inline form /
 * Connect wallet) so the funnel works end-to-end without backend routes — real
 * pricing checkout + server-side demo capture are tracked as separate P1/P7 tasks.
 */

const NAV = [
  { href: "#how", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
];

const LIFECYCLE = [
  { n: 0, state: "None", action: "—" },
  { n: 1, state: "Minted", action: "mint" },
  { n: 2, state: "Bound", action: "bind NFC" },
  { n: 3, state: "Activated", action: "activate" },
  { n: 4, state: "Claimed", action: "claim" },
  { n: 5, state: "Flagged", action: "flag" },
  { n: 6, state: "Recycled", action: "recycle" },
];

const FEATURES = [
  {
    icon: Package,
    title: "Products on-chain",
    body: "Mint a cryptographic digital twin for every physical good — NFC-bound and tracked across its full lifecycle.",
  },
  {
    icon: Bot,
    title: "Autonomous agents",
    body: "Deploy ERC-8004 agents with on-chain identity and reputation that sell, verify, and protect your inventory under your control.",
  },
  {
    icon: ShieldCheck,
    title: "Trustless verification",
    body: "Anyone — human or agent — can verify authenticity straight from Base. No portal, no trust-us.",
  },
  {
    icon: GitBranch,
    title: "Provenance",
    body: "Compose assets into verifiable provenance trees — origin, components, and custody, end to end.",
  },
  {
    icon: FileCheck,
    title: "Compliance",
    body: "Query origin, recall, sanctions, and grade in one call. Audit-ready, on-chain custody events.",
  },
  {
    icon: LifeBuoy,
    title: "Recovery (AIRP)",
    body: "Lost or stolen? A 2-of-3 quorum recovery protocol restores custody without trusting a single party.",
  },
];

const TIERS = [
  {
    name: "Verify",
    price: "Always free",
    tagline: "For anyone checking authenticity",
    features: ["Unlimited verification", "On-chain proof", "No wallet required to verify"],
    highlight: false,
  },
  {
    name: "Build",
    price: "Pay-as-you-go · USDC",
    tagline: "For businesses running the lifecycle",
    features: [
      "Mint & bind products",
      "Deploy autonomous agents",
      "Metered agent usage in USDC",
      "Provenance & compliance",
    ],
    highlight: true,
  },
  {
    name: "Scale",
    price: "Custom",
    tagline: "For enterprises & defense",
    features: ["SLAs & support", "Custom agents & skills", "Tax & connectors", "US-hosted, compliance-ready"],
    highlight: false,
  },
];

function RequestAccessForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const valid = name.trim() && /.+@.+\..+/.test(email) && company.trim();

  if (submitted) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary">
            <Check className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="text-lg font-semibold">You&apos;re on the list</div>
          <p className="text-sm text-muted-foreground">
            Thanks, {name.trim().split(" ")[0]}. We&apos;ll reach out about your demo and free
            early-access seat. No wallet needed to request access.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardContent className="p-6 space-y-4">
        <div className="space-y-1">
          <div className="text-lg font-semibold">Request access</div>
          <p className="text-sm text-muted-foreground">
            Get a demo and claim a free early-access seat (first 5 businesses).
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ra-name">Your name</Label>
          <Input id="ra-name" placeholder="Jane Doe" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ra-email">Work email</Label>
          <Input
            id="ra-email"
            type="email"
            placeholder="jane@acme.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ra-company">Company</Label>
          <Input
            id="ra-company"
            placeholder="Acme Goods Inc."
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        </div>
        <Button className="w-full" disabled={!valid} onClick={() => setSubmitted(true)}>
          Request a demo
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Already have a wallet? Use “Launch app” above to start now.
        </p>
      </CardContent>
    </Card>
  );
}

export function MarketingLanding() {
  return (
    <div className="min-h-screen flex flex-col scroll-smooth">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-6 md:px-10 border-b bg-background/80 backdrop-blur">
        <div className="flex items-center gap-3">
          <Image src="/tagit_logo.png" alt="TAG IT Network" width={32} height={32} priority />
          <span className="font-semibold tracking-tight">TAG IT Business</span>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="hover:text-foreground transition-colors">
              {n.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <a href="#get-started" className="hidden sm:block">
            <Button variant="outline" size="sm">
              Request demo
            </Button>
          </a>
          <ConnectButton />
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-5xl px-6 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            Free verification · Built on Base
          </div>
          <h1 className="mt-6 text-4xl md:text-6xl font-bold tracking-tight">
            Commerce, run by agents.
            <br />
            Verified by the chain.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            Give every product a cryptographic digital twin, deploy autonomous AI agents that sell
            and protect your inventory, and let anyone verify authenticity straight from Base.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <ConnectButton className="h-12 px-8 text-base" />
            <a href="#get-started">
              <Button variant="outline" className="h-12 px-8 text-base">
                Request a demo
              </Button>
            </a>
          </div>
          <a
            href="#pricing"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" />
            First 5 businesses get a free seat — claim yours
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </section>

        {/* How it works — 7-state lifecycle */}
        <section id="how" className="scroll-mt-20 border-t bg-secondary/40">
          <div className="mx-auto max-w-5xl px-6 py-16">
            <div className="text-center">
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                One lifecycle, end to end
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
                Every asset moves through seven on-chain states — minted, bound to a physical NFC
                tag, activated, claimed by its owner, and recoverable or recycled.
              </p>
            </div>
            <ol className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {LIFECYCLE.map((s) => (
                <li
                  key={s.n}
                  className="flex flex-col items-center rounded-lg border bg-card p-4 text-center"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {s.n}
                  </span>
                  <span className="mt-2 text-sm font-medium">{s.state}</span>
                  <span className="mt-0.5 text-xs text-muted-foreground">{s.action}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-20">
          <div className="mx-auto max-w-5xl px-6 py-16">
            <div className="text-center">
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                Everything to run verified commerce
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
                From minting to recovery — on-chain, agent-operated, and verifiable by anyone.
              </p>
            </div>
            <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <Card key={f.title}>
                  <CardContent className="p-6 space-y-3">
                    <f.icon className="h-6 w-6" />
                    <div className="font-semibold">{f.title}</div>
                    <p className="text-sm text-muted-foreground">{f.body}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing teaser */}
        <section id="pricing" className="scroll-mt-20 border-t bg-secondary/40">
          <div className="mx-auto max-w-5xl px-6 py-16">
            <div className="text-center">
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                Verification is free. Forever.
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
                You only pay — in USDC — for what your agents transact. No subscriptions to verify
                the truth.
              </p>
            </div>

            <div className="mt-6 flex justify-center">
              <div className="inline-flex items-center gap-2 rounded-full border bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground">
                <Sparkles className="h-4 w-4" />
                First 5 businesses: free early-access seat
              </div>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
              {TIERS.map((t) => (
                <Card
                  key={t.name}
                  className={t.highlight ? "border-primary ring-1 ring-primary" : undefined}
                >
                  <CardContent className="p-6 space-y-4">
                    <div className="space-y-1">
                      <div className="font-semibold">{t.name}</div>
                      <div className="text-2xl font-bold tracking-tight">{t.price}</div>
                      <p className="text-sm text-muted-foreground">{t.tagline}</p>
                    </div>
                    <ul className="space-y-2">
                      {t.features.map((feat) => (
                        <li key={feat} className="flex items-start gap-2 text-sm">
                          <Check className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                    <a href={t.name === "Scale" ? "#get-started" : "#get-started"} className="block">
                      <Button className="w-full" variant={t.highlight ? "default" : "outline"}>
                        {t.name === "Verify" ? "Start verifying" : "Get started"}
                      </Button>
                    </a>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Get started / request access */}
        <section id="get-started" className="scroll-mt-20">
          <div className="mx-auto grid max-w-5xl items-center gap-10 px-6 py-20 lg:grid-cols-2">
            <div className="space-y-4">
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                Start in minutes — or talk to us
              </h2>
              <p className="text-muted-foreground">
                Already have a wallet? Launch the app and onboard your business now. Prefer a
                walkthrough? Request a demo and claim one of the first 5 free seats.
              </p>
              <ul className="space-y-2">
                {["No setup fees", "Verification always free", "US-hosted, security-first"].map(
                  (p) => (
                    <li key={p} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4" />
                      <span>{p}</span>
                    </li>
                  ),
                )}
              </ul>
              <div className="pt-2">
                <ConnectButton className="h-11 px-6" />
              </div>
            </div>
            <div className="flex justify-center lg:justify-end">
              <RequestAccessForm />
            </div>
          </div>
        </section>
      </main>

      <footer className="h-14 border-t flex items-center justify-center text-xs text-muted-foreground">
        TAG IT Network — built on Base
      </footer>
    </div>
  );
}
