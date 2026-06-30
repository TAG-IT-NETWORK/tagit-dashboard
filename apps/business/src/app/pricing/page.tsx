"use client";

import Link from "next/link";
import Image from "next/image";
import { Button, Card, CardContent, ConnectButton } from "@tagit/ui";
import { ArrowLeft, ArrowRight, Check, Minus, Sparkles } from "lucide-react";

/**
 * Dedicated public pricing page (/pricing) for pro.tagit.network.
 * Crypto-native model: verification is always free; businesses pay in USDC only for
 * what their agents transact. First 5 businesses get a free Build seat (early access).
 * Non-wallet-gated; reuses the landing's black-and-white design system.
 */

const TIERS = [
  {
    name: "Verify",
    price: "Free",
    cadence: "forever",
    tagline: "For anyone checking authenticity.",
    cta: "Start verifying",
    highlight: false,
    features: [
      "Unlimited verification",
      "On-chain proof of authenticity",
      "No wallet required to verify",
      "Public provenance lookups",
    ],
  },
  {
    name: "Build",
    price: "Pay-as-you-go",
    cadence: "in USDC",
    tagline: "For businesses running the lifecycle.",
    cta: "Get started",
    highlight: true,
    features: [
      "Everything in Verify",
      "Mint & NFC-bind products",
      "Deploy autonomous agents",
      "Metered agent usage in USDC",
      "Provenance & compliance tools",
      "Email support",
    ],
  },
  {
    name: "Scale",
    price: "Custom",
    cadence: "talk to us",
    tagline: "For enterprises & defense.",
    cta: "Request a demo",
    highlight: false,
    features: [
      "Everything in Build",
      "SLAs & priority support",
      "Custom agents & skills",
      "Tax & data connectors",
      "US-hosted, compliance-ready",
    ],
  },
];

type Cell = boolean | string;
const COMPARISON: { label: string; cells: [Cell, Cell, Cell] }[] = [
  { label: "Verification", cells: ["Unlimited", "Unlimited", "Unlimited"] },
  { label: "Mint & bind products", cells: [false, true, true] },
  { label: "Autonomous agents", cells: [false, true, "Custom"] },
  { label: "Billing", cells: ["—", "USDC, metered", "Custom"] },
  { label: "Provenance & compliance", cells: [false, true, true] },
  { label: "Tax & connectors", cells: [false, false, true] },
  { label: "Support", cells: ["Community", "Email", "SLA + priority"] },
  { label: "Hosting", cells: ["US", "US", "US, compliance-ready"] },
];

const FAQ = [
  {
    q: "Is verification really free?",
    a: "Yes — anyone can verify a product's authenticity and provenance straight from Base, with no account and no wallet. We never charge to verify the truth.",
  },
  {
    q: "How does USDC billing work?",
    a: "Businesses pay in USDC only for what their agents actually transact — metered, pay-as-you-go. No monthly subscription to mint, bind, or run the lifecycle.",
  },
  {
    q: "What's the “first 5 free” offer?",
    a: "The first 5 businesses to onboard get a free Build seat during early access. Request a demo to claim one while they last.",
  },
  {
    q: "Do I need to hold crypto to start?",
    a: "No. You can sign up with email — an embedded wallet is created for you. USDC billing only applies once your agents start transacting.",
  },
  {
    q: "Where is my data hosted?",
    a: "Core data is US-hosted and security-first, with on-chain custody events for an audit-ready trail. Enterprise plans add compliance-ready controls.",
  },
];

function CompCell({ value }: { value: Cell }) {
  if (value === true) return <Check className="mx-auto h-4 w-4" aria-label="Included" />;
  if (value === false)
    return <Minus className="mx-auto h-4 w-4 text-muted-foreground" aria-label="Not included" />;
  return <span className="text-sm">{value}</span>;
}

export default function PricingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-6 md:px-10 border-b bg-background/80 backdrop-blur">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/tagit_logo.png" alt="TAG IT Network" width={32} height={32} priority />
          <span className="font-semibold tracking-tight">TAG IT Business</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/" className="hidden sm:block">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Home
            </Button>
          </Link>
          <ConnectButton />
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-5xl px-6 pt-16 pb-10 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            Verification is free · Pay only in USDC for what agents transact
          </div>
          <h1 className="mt-6 text-4xl md:text-5xl font-bold tracking-tight">Simple, honest pricing</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            No subscriptions to verify the truth. Run the full lifecycle and pay as you go — and the
            first 5 businesses get a free Build seat.
          </p>
        </section>

        {/* Tiers */}
        <section className="mx-auto max-w-5xl px-6 pb-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {TIERS.map((t) => (
              <Card key={t.name} className={t.highlight ? "border-primary ring-1 ring-primary" : undefined}>
                <CardContent className="p-6 space-y-5">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{t.name}</div>
                      {t.highlight ? (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                          Popular
                        </span>
                      ) : null}
                    </div>
                    <div className="text-2xl font-bold tracking-tight">{t.price}</div>
                    <div className="text-xs text-muted-foreground">{t.cadence}</div>
                    <p className="pt-1 text-sm text-muted-foreground">{t.tagline}</p>
                  </div>
                  <ul className="space-y-2">
                    {t.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href={t.name === "Verify" ? "/" : "/#get-started"} className="block">
                    <Button className="w-full" variant={t.highlight ? "default" : "outline"}>
                      {t.cta}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Free-first-5 banner */}
        <section className="mx-auto max-w-5xl px-6 py-6">
          <div className="flex flex-col items-center justify-between gap-4 rounded-xl border bg-secondary/50 p-6 text-center sm:flex-row sm:text-left">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <div className="font-semibold">First 5 businesses: free Build seat</div>
                <p className="text-sm text-muted-foreground">
                  Early-access pricing for our first customers. Claim one while they last.
                </p>
              </div>
            </div>
            <Link href="/#get-started">
              <Button>
                Claim your seat
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>

        {/* Comparison table */}
        <section className="mx-auto max-w-5xl px-6 py-10">
          <h2 className="text-center text-2xl font-bold tracking-tight">Compare plans</h2>
          <div className="mt-8 overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b">
                  <th className="py-3 pr-4 text-sm font-medium text-muted-foreground">Feature</th>
                  {TIERS.map((t) => (
                    <th key={t.name} className="px-4 py-3 text-center text-sm font-semibold">
                      {t.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr key={row.label} className="border-b">
                    <td className="py-3 pr-4 text-sm font-medium">{row.label}</td>
                    {row.cells.map((c, i) => (
                      <td key={i} className="px-4 py-3 text-center">
                        <CompCell value={c} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t bg-secondary/40">
          <div className="mx-auto max-w-3xl px-6 py-14">
            <h2 className="text-center text-2xl font-bold tracking-tight">Frequently asked</h2>
            <dl className="mt-8 space-y-6">
              {FAQ.map((item) => (
                <div key={item.q} className="rounded-lg border bg-card p-5">
                  <dt className="font-medium">{item.q}</dt>
                  <dd className="mt-2 text-sm text-muted-foreground">{item.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-5xl px-6 py-16 text-center">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Ready to start?</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Verification is free to try right now. Launch the app, or request a demo and claim a free
            early-access seat.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <ConnectButton className="h-12 px-8 text-base" />
            <Link href="/#get-started">
              <Button variant="outline" className="h-12 px-8 text-base">
                Request a demo
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="h-14 border-t flex items-center justify-center text-xs text-muted-foreground">
        TAG IT Network — built on Base
      </footer>
    </div>
  );
}
