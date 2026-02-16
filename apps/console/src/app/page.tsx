"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, ConnectButton } from "@tagit/ui";
import { useTotalSupply } from "@tagit/contracts";
import { WagmiGuard } from "@/components/wagmi-guard";

export default function ConsolePage() {
  return (
    <WagmiGuard>
      <ConsoleContent />
    </WagmiGuard>
  );
}

function ConsoleContent() {
  const { data: totalSupply, isLoading } = useTotalSupply();
  const total = totalSupply ? Number(totalSupply) : 0;

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">TAG IT Console</h1>
            <p className="text-muted-foreground">B2B Portal</p>
          </div>
          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-2 text-sm">
              <Link href="/" className="px-3 py-2 rounded-md bg-primary/10 text-primary font-medium">
                Dashboard
              </Link>
              <Link href="/assets" className="px-3 py-2 rounded-md hover:bg-muted transition-colors">
                Assets
              </Link>
              <Link href="/badges" className="px-3 py-2 rounded-md hover:bg-muted transition-colors">
                Badges
              </Link>
            </nav>
            <ConnectButton />
          </div>
        </header>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Link href="/assets">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle>My Assets</CardTitle>
                <CardDescription>Digital twins you manage</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {isLoading ? (
                    <span className="inline-block h-8 w-12 animate-pulse bg-muted rounded" />
                  ) : (
                    total.toLocaleString()
                  )}
                </p>
                <p className="text-sm text-muted-foreground">Total assets on network</p>
              </CardContent>
            </Card>
          </Link>

          <Card>
            <CardHeader>
              <CardTitle>Mint</CardTitle>
              <CardDescription>Create new digital twins</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Requires MANUFACTURER badge
              </p>
            </CardContent>
          </Card>

          <Link href="/badges">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle>Badges</CardTitle>
                <CardDescription>Identity &amp; role badges</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  View your KYC, role, and authority badges
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </main>
  );
}
