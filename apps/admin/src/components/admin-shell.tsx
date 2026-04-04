"use client";

import { type ReactNode, useState } from "react";
import { useAccount } from "wagmi";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { Button } from "@tagit/ui";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Wallet, Loader2 } from "lucide-react";

interface AdminShellProps {
  children: ReactNode;
}

export function AdminShell({ children }: AdminShellProps) {
  const { isConnected, isConnecting } = useAccount();
  const { openConnectModal } = useConnectModal();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto">
            {isConnecting ? (
              <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-muted-foreground">Connecting wallet...</p>
              </div>
            ) : !isConnected ? (
              <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <Wallet className="h-12 w-12 text-muted-foreground" />
                <h2 className="text-xl font-semibold">Connect Wallet</h2>
                <p className="text-muted-foreground text-center max-w-md">
                  Connect your wallet to access the TAG IT Admin Console. You need a KYC identity
                  badge to perform privileged operations.
                </p>
                <Button onClick={openConnectModal}>
                  <Wallet className="h-4 w-4 mr-2" />
                  Connect Wallet
                </Button>
              </div>
            ) : (
              children
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
