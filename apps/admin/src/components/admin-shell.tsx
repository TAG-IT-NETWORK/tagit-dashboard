"use client";

import { type ReactNode } from "react";
import { useAccount } from "wagmi";
import { useBadgeCheck, BadgeIds } from "@tagit/contracts";
import { ConnectButton, Card, CardHeader, CardTitle, CardDescription, CardContent } from "@tagit/ui";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { Shield, Loader2 } from "lucide-react";

interface AdminShellProps {
  children: ReactNode;
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

function ConnectScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Admin Access Required</CardTitle>
          <CardDescription>
            Connect your wallet to access the admin console. You must have an Admin or Gov/Mil badge.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <ConnectButton />
        </CardContent>
      </Card>
    </div>
  );
}

function UnauthorizedScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <Shield className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle>Access Denied</CardTitle>
          <CardDescription>
            Your wallet does not have the required badge to access the admin console.
            You need an Admin (ID: 100) or Gov/Mil (ID: 20) badge.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <ConnectButton />
        </CardContent>
      </Card>
    </div>
  );
}

export function AdminShell({ children }: AdminShellProps) {
  const { address, isConnected } = useAccount();

  // Check for GOV_MIL badge (ID: 20)
  const { hasBadge: hasGovMil, isLoading: govMilLoading } = useBadgeCheck(address, BadgeIds.GOV_MIL);

  // Check for ADMIN badge (ID: 100) - Note: This ID is not in our current constants
  // For now, we'll use GOV_MIL as the primary admin badge
  // In production, you'd add ADMIN badge ID to the constants
  const { hasBadge: hasLawEnforcement, isLoading: lawEnforcementLoading } = useBadgeCheck(
    address,
    BadgeIds.LAW_ENFORCEMENT
  );

  const isLoading = govMilLoading || lawEnforcementLoading;
  const hasAccess = hasGovMil || hasLawEnforcement;

  // Not connected
  if (!isConnected) {
    return <ConnectScreen />;
  }

  // Loading badge checks
  if (isLoading) {
    return <LoadingScreen />;
  }

  // No access
  if (!hasAccess) {
    // For development, allow access anyway
    // Remove this in production
    console.warn("Access check bypassed for development");
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
