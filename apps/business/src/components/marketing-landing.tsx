"use client";

import { useState } from "react";
import Image from "next/image";
import { Button, Card, CardContent, ConnectButton, Input, Label, cn } from "@tagit/ui";
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
 * Shown to disconnected visitors. Written for non-crypto SMB owners: plain-English
 * copy, "Request a demo" as the primary CTA, wallet entry demoted to "Launch app".
 * Demo requests POST to /api/demo-request (webhook/Notion sinks — see that route
 * for the env contract); real pricing checkout is tracked as a separate P1 task.
 */

const NAV = [
  { href: "#how", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
];

/** Happy-path steps the business performs (on-chain states 1–3). */
const BUSINESS_STEPS = [
  {
    n: 1,
    title: "Register the product",
    body: "Add it in your dashboard and it gets a permanent digital certificate — a birth certificate that can't be forged or duplicated.",
    state: "Minted",
  },
  {
    n: 2,
    title: "Attach the smart tag",
    body: "Stick a small NFC tag on the item — the same tap technology as a contactless bank card. We lock it to the certificate, so it can't be cloned or swapped onto a fake.",
    state: "Bound",
  },
  {
    n: 3,
    title: "Approve it for sale",
    body: "Run your final quality check and mark it ready. From this moment, anyone who taps the tag sees proof it's genuine.",
    state: "Activated",
  },
];

const FEATURES = [
  {
    icon: Package,
    title: "A permanent record for every product",
    body: "Each item gets a tamper-proof digital certificate tied to its tag — new entries are added at every step from factory to customer, and past entries can never be changed.",
  },
  {
    icon: Bot,
    title: "AI assistants for your inventory",
    body: "Set up AI helpers that list products, answer authenticity checks, and watch for fakes — 24/7, under rules you control.",
  },
  {
    icon: ShieldCheck,
    title: "Anyone can check, instantly",
    body: "Customers, retailers, and marketplaces verify authenticity with one tap. No account, no calling you, no taking anyone's word for it.",
  },
  {
    icon: GitBranch,
    title: "The full story, part by part",
    body: "Show where an item came from, what it's made of, and every hand it passed through. Proof, not promises.",
  },
  {
    icon: FileCheck,
    title: "Audit-ready records, automatically",
    body: "Origin, recall, sanctions, and grading checks come together in seconds — in a format auditors and regulators accept.",
  },
  {
    icon: LifeBuoy,
    title: "Lost or stolen? Recoverable.",
    body: "Flag an item and every future tap shows a warning. A built-in, rules-based recovery process returns it to its rightful owner.",
  },
];

const TIERS = [
  {
    name: "Build",
    price: "Pay as you go",
    tagline: "For businesses protecting their products",
    features: [
      "Register and tag your products",
      "Set up AI sales & protection assistants",
      "Pay only for what your assistants do — billed in USDC, a digital dollar",
      "History & compliance reports included",
    ],
    highlight: true,
    cta: "Request a demo",
  },
  {
    name: "Scale",
    price: "Custom",
    tagline: "For enterprises & government",
    features: [
      "Guaranteed response times & dedicated support",
      "Custom-built AI assistants",
      "Connects to your accounting & inventory systems",
      "US-hosted, compliance-ready",
    ],
    highlight: false,
    cta: "Talk to sales",
  },
];

function ActorLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
      {children}
      <span className="h-px flex-1 bg-border" aria-hidden />
    </p>
  );
}

function StateChip({ state }: { state: string }) {
  return (
    <span className="mt-3 inline-block rounded bg-secondary px-2 py-0.5 font-mono text-[11px] text-secondary-foreground/70">
      on-chain: {state}
    </span>
  );
}

function RequestAccessForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  // Honeypot — hidden from real users; bots that fill it are silently dropped server-side.
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [submitted, setSubmitted] = useState(false);

  const valid = Boolean(name.trim() && /.+@.+\..+/.test(email) && company.trim());

  const submit = async () => {
    if (!valid || status === "sending") return;
    setStatus("sending");
    try {
      const res = await fetch("/api/demo-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, company, website }),
      });
      if (!res.ok) throw new Error(`capture failed (${res.status})`);
      setSubmitted(true);
    } catch {
      setStatus("error");
    }
  };

  if (submitted) {
    return (
      <Card className="w-full max-w-md">
        <CardContent role="status" className="p-8 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary">
            <Check className="h-6 w-6 text-primary-foreground" />
          </div>
          <h3 className="text-lg font-semibold">You&apos;re on the list</h3>
          <p className="text-sm text-muted-foreground">
            Thanks, {name.trim().split(" ")[0]}. We&apos;ll reach out about your demo — and whether
            one of the 5 early-access seats is still open.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardContent className="p-6 space-y-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Request access</h3>
          <p className="text-sm text-muted-foreground">
            Get a demo and claim a free early-access seat (first 5 businesses). No wallet or crypto
            knowledge needed.
          </p>
        </div>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="ra-name">Your name</Label>
            <Input
              id="ra-name"
              autoComplete="name"
              placeholder="Jane Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ra-email">Work email</Label>
            <Input
              id="ra-email"
              type="email"
              autoComplete="email"
              placeholder="jane@acme.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ra-company">Company</Label>
            <Input
              id="ra-company"
              autoComplete="organization"
              placeholder="Acme Goods Inc."
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </div>
          <div className="hidden" aria-hidden="true">
            <label htmlFor="ra-website">Website</label>
            <input
              id="ra-website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={!valid || status === "sending"}>
            {status === "sending" ? "Sending…" : "Request a demo"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          {status === "error" && (
            <p role="alert" className="text-center text-xs text-destructive">
              Something went wrong and your request wasn&apos;t sent. Please try again, or email{" "}
              <a href="mailto:info@tagit.network" className="underline underline-offset-2">
                info@tagit.network
              </a>
              .
            </p>
          )}
        </form>
        <p className="text-center text-xs text-muted-foreground">
          Already using TAG IT? Use &quot;Launch app&quot; above to continue.
        </p>
      </CardContent>
    </Card>
  );
}

export function MarketingLanding() {
  return (
    <div className="min-h-screen flex flex-col">
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
          <Button asChild size="sm">
            <a href="#get-started">Request a demo</a>
          </Button>
          <div className="hidden sm:block">
            <ConnectButton variant="outline" label="Launch app" className="h-8 px-3 text-xs" />
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-5xl px-6 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            Free verification for your customers — forever
          </div>
          <h1 className="mt-6 text-4xl md:text-6xl font-bold tracking-tight">
            Prove your products are real.
            <br />
            With one tap.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            Put a small smart tag on each item you sell. Customers tap it with their phone and
            instantly see it&apos;s genuine — backed by a permanent record no one can fake, edit, or
            delete.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild className="h-12 px-8 text-base">
              <a href="#get-started">Request a demo</a>
            </Button>
            <ConnectButton variant="outline" label="Launch app" className="h-12 px-8 text-base" />
          </div>
          <a
            href="#get-started"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" />
            First 5 businesses get a free seat — claim yours
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </section>

        {/* How it works — 4-step journey grouped by actor */}
        <section id="how" className="scroll-mt-20 border-t bg-secondary/40">
          <div className="mx-auto max-w-5xl px-6 py-16">
            <div className="text-center">
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">How it works</h2>
              <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
                Three steps for you, one tap for your customer — and every step is written to a
                permanent record that can&apos;t be faked or rewritten.
              </p>
            </div>

            <div className="mt-10 space-y-8">
              <div>
                <ActorLabel>You — in your workshop</ActorLabel>
                <ol className="mt-4 grid grid-cols-1 gap-8 md:grid-cols-3">
                  {BUSINESS_STEPS.map((s, i) => (
                    <li key={s.n} className="relative">
                      {i > 0 && (
                        <ArrowRight
                          className="absolute -left-6 top-1.5 hidden h-4 w-4 text-muted-foreground md:block"
                          aria-hidden
                        />
                      )}
                      <span
                        aria-hidden
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
                      >
                        {s.n}
                      </span>
                      <h3 className="mt-3 font-semibold">{s.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
                      <StateChip state={s.state} />
                    </li>
                  ))}
                </ol>
              </div>

              <div>
                <ActorLabel>Your customer — anywhere</ActorLabel>
                <div className="mt-4 rounded-xl border border-primary bg-card p-5 sm:flex sm:items-start sm:gap-4">
                  <span
                    aria-hidden
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
                  >
                    4
                  </span>
                  <div className="mt-3 sm:mt-0">
                    <h3 className="font-semibold">Tap to verify — and own it</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      They tap the tag with their phone — no app, no account — and instantly see
                      it&apos;s genuine. One more step claims it as theirs, making warranty and
                      resale simple.
                    </p>
                    <StateChip state="Claimed" />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-dashed bg-secondary/60 p-5">
                <h3 className="text-sm font-semibold">Protected for life</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Lost, stolen, or recalled? Flag it — every future tap shows a warning until
                  it&apos;s recovered and cleared. At true end of life, retire the record for good;
                  its history stays readable forever.
                </p>
                <StateChip state="Flagged · Recycled" />
              </div>

              <p className="text-center text-xs text-muted-foreground">
                Under the hood, these are on-chain states enforced by our smart contracts on Base.
              </p>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-20">
          <div className="mx-auto max-w-5xl px-6 py-16">
            <div className="text-center">
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                Everything you need to sell verified goods
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
                From the day it&apos;s made to the day it&apos;s retired — every product provable,
                by anyone, for free.
              </p>
            </div>
            <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <Card key={f.title}>
                  <CardContent className="p-6 space-y-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <f.icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-semibold">{f.title}</h3>
                    <p className="text-sm text-muted-foreground">{f.body}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-20 border-t bg-secondary/40">
          <div className="mx-auto max-w-5xl px-6 py-16">
            <div className="text-center">
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                Verification is free. Forever.
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
                Your customers never pay to check a product — and neither do you. You only pay for
                what you actually use.
              </p>
            </div>

            <div className="mt-6 flex justify-center">
              <a
                href="#get-started"
                className="inline-flex items-center gap-2 rounded-full border bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Sparkles className="h-4 w-4" />
                First 5 businesses: free early-access seat
              </a>
            </div>

            <div className="mx-auto mt-10 max-w-3xl rounded-xl border bg-card p-5 text-center text-sm">
              <span className="font-semibold">Free for everyone, always:</span>{" "}
              <span className="text-muted-foreground">
                anyone can tap a tag and verify authenticity — no app, no account, no wallet.
              </span>
            </div>

            <div className="mx-auto mt-6 grid max-w-3xl grid-cols-1 gap-4 md:grid-cols-2">
              {TIERS.map((t) => (
                <Card
                  key={t.name}
                  className={cn(
                    "flex h-full flex-col",
                    t.highlight && "relative border-primary ring-1 ring-primary",
                  )}
                >
                  {t.highlight && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
                      Recommended
                    </span>
                  )}
                  <CardContent className="flex flex-1 flex-col p-6 space-y-4">
                    <div className="space-y-1">
                      <h3 className="font-semibold">{t.name}</h3>
                      <div className="text-2xl font-bold tracking-tight">{t.price}</div>
                      <p className="text-sm text-muted-foreground">{t.tagline}</p>
                    </div>
                    <ul className="flex-1 space-y-2">
                      {t.features.map((feat) => (
                        <li key={feat} className="flex items-start gap-2 text-sm">
                          <Check className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      asChild
                      className="mt-auto w-full"
                      variant={t.highlight ? "default" : "outline"}
                    >
                      <a href="#get-started">{t.cta}</a>
                    </Button>
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
                Start in minutes — or talk to us first
              </h2>
              <p className="text-muted-foreground">
                Set up your business account and tag your first products today. Prefer a
                walkthrough? Request a demo and claim one of the first 5 free seats.
              </p>
              <ul className="space-y-2">
                {[
                  "No crypto knowledge needed — we'll walk you through setup",
                  "No setup fees",
                  "Verification always free",
                  "US-hosted, security-first",
                ].map((p) => (
                  <li key={p} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
              <div className="pt-2">
                <ConnectButton variant="outline" label="Launch app" className="h-11 px-6" />
              </div>
            </div>
            <div className="flex justify-center lg:justify-end">
              <RequestAccessForm />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t px-6 py-5 flex items-center justify-center text-center text-xs text-muted-foreground">
        TAG IT Network — records secured on Base, a public network built by Coinbase
      </footer>
    </div>
  );
}
