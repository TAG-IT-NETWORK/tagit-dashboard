"use client";

import { useAccount } from "wagmi";
import { Button, Card, CardContent, ConnectButton } from "@tagit/ui";
import { ArrowRight, Mail, Wallet } from "lucide-react";
import { useSiweLogin } from "@/lib/use-siwe";

/**
 * Two-path sign-in:
 *   • Connect a wallet  → existing wallet (RainbowKit/wagmi) → SIWE
 *   • Create a wallet   → email via Privy (embedded wallet) → SIWE  [enabled once
 *                          NEXT_PUBLIC_PRIVY_APP_ID + the Privy provider are wired, T4b]
 * Both converge on the same SIWE → server-session path. Calls onSignedIn() on success.
 */
export function SignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const { isConnected } = useAccount();
  const { status, error, login } = useSiweLogin();
  const privyConfigured = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);
  const busy = status === "signing" || status === "verifying";

  async function handleSignIn() {
    const res = await login();
    if (res?.ok) onSignedIn();
  }

  return (
    <Card className="w-full max-w-md">
      <CardContent className="p-6 space-y-5">
        <div className="space-y-1 text-center">
          <div className="text-lg font-semibold">Sign in to TAG IT Business</div>
          <p className="text-sm text-muted-foreground">
            Use a wallet you already have, or create one with your email.
          </p>
        </div>

        {!isConnected ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Wallet className="h-4 w-4" /> Connect a wallet
              </div>
              <ConnectButton className="w-full" />
            </div>

            <div className="relative flex items-center">
              <div className="flex-1 border-t" />
              <span className="px-3 text-xs text-muted-foreground">or</span>
              <div className="flex-1 border-t" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Mail className="h-4 w-4" /> Create a wallet
              </div>
              <Button variant="outline" className="w-full" disabled>
                {privyConfigured ? "Continue with email" : "Email sign-up (coming soon)"}
              </Button>
              <p className="text-xs text-muted-foreground">
                No crypto needed — a secure wallet is created for you.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-center text-sm text-muted-foreground">
              Wallet connected. Sign the message to prove ownership — no gas, no transaction.
            </p>
            <Button className="w-full" onClick={handleSignIn} disabled={busy}>
              {status === "signing" ? (
                "Check your wallet…"
              ) : status === "verifying" ? (
                "Signing in…"
              ) : (
                <>
                  Sign in
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
            <ConnectButton className="w-full" />
          </div>
        )}

        {error ? (
          <p role="alert" className="text-center text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
