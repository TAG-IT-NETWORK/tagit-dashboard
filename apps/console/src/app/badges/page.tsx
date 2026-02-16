"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, ConnectButton } from "@tagit/ui";
import { BadgeCategories, BadgeIdNames, type BadgeId, useBadges } from "@tagit/contracts";
import { useAccount } from "@tagit/contracts";
import { WagmiGuard } from "@/components/wagmi-guard";

const categoryMeta: Record<string, { title: string; description: string }> = {
  KYC: { title: "KYC Levels", description: "Know Your Customer verification levels" },
  ENTITY: { title: "Entity Roles", description: "Business entity type badges" },
  AUTHORITY: { title: "Authority", description: "Government and law enforcement badges" },
};

export default function BadgesPage() {
  return (
    <WagmiGuard>
      <BadgesContent />
    </WagmiGuard>
  );
}

function BadgesContent() {
  const { address } = useAccount();
  const { badges, isLoading } = useBadges(address);
  const heldBadgeIds = new Set(badges.map((b) => b.id));

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
              <Link href="/" className="px-3 py-2 rounded-md hover:bg-muted transition-colors">
                Dashboard
              </Link>
              <Link href="/assets" className="px-3 py-2 rounded-md hover:bg-muted transition-colors">
                Assets
              </Link>
              <Link href="/badges" className="px-3 py-2 rounded-md bg-primary/10 text-primary font-medium">
                Badges
              </Link>
            </nav>
            <ConnectButton />
          </div>
        </header>

        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Badges</h2>
            <p className="text-muted-foreground">
              {address
                ? `Identity and role badges for your wallet`
                : "Connect your wallet to view your badges"}
            </p>
          </div>

          {!address && (
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-muted-foreground mb-4">Please connect your wallet to view badge status.</p>
              </CardContent>
            </Card>
          )}

          {address && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {Object.entries(BadgeCategories).map(([categoryKey, badgeIds]) => {
                const meta = categoryMeta[categoryKey] ?? { title: categoryKey, description: "" };
                return (
                  <Card key={categoryKey}>
                    <CardHeader>
                      <CardTitle>{meta.title}</CardTitle>
                      <CardDescription>{meta.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {isLoading ? (
                        <div className="space-y-2">
                          {badgeIds.map((id) => (
                            <div key={id} className="h-8 animate-pulse bg-muted rounded" />
                          ))}
                        </div>
                      ) : (
                        <ul className="space-y-2">
                          {badgeIds.map((id) => {
                            const held = heldBadgeIds.has(id as BadgeId);
                            return (
                              <li
                                key={id}
                                className={`flex items-center justify-between px-3 py-2 rounded-md border ${
                                  held ? "border-green-500/50 bg-green-500/10" : "border-muted"
                                }`}
                              >
                                <span className={held ? "font-medium" : "text-muted-foreground"}>
                                  {BadgeIdNames[id as BadgeId] ?? `Badge #${id}`}
                                </span>
                                <span
                                  className={`text-xs px-2 py-0.5 rounded-full ${
                                    held
                                      ? "bg-green-500/20 text-green-500"
                                      : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  {held ? "Held" : "Not held"}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {address && !isLoading && badges.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Your Badges</CardTitle>
                <CardDescription>Badges currently held by your wallet</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {badges.map((badge) => (
                    <span
                      key={badge.id}
                      className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium"
                    >
                      {badge.name}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}
