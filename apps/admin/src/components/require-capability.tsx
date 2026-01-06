"use client";

import { type ReactNode } from "react";
import { useAccount, useCapabilityGate, Capabilities, CapabilityNames, type CapabilityHash } from "@tagit/contracts";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, Button, Badge } from "@tagit/ui";
import { ShieldX, Wallet, Loader2 } from "lucide-react";
import { useConnectModal } from "@rainbow-me/rainbowkit";

interface RequireCapabilityProps {
  children: ReactNode;
  capability: CapabilityHash;
  /** If true, shows inline message instead of full card */
  inline?: boolean;
  /** Custom fallback when capability check fails */
  fallback?: ReactNode;
  /** If true, shows a loading state while checking */
  showLoading?: boolean;
}

/**
 * RequireCapability gates content based on user's on-chain capabilities.
 * - Shows connect wallet prompt if not connected
 * - Shows access denied if user lacks required capability
 * - Renders children if user has the capability
 */
export function RequireCapability({
  children,
  capability,
  inline = false,
  fallback,
  showLoading = true,
}: RequireCapabilityProps) {
  const { address, isConnected, isConnecting } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { hasCapability, isLoading } = useCapabilityGate(address, capability);

  const capabilityName = CapabilityNames[capability] || "Unknown";

  // Loading state
  if ((isConnecting || isLoading) && showLoading) {
    if (inline) {
      return (
        <span className="inline-flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking permissions...
        </span>
      );
    }
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Not connected
  if (!isConnected || !address) {
    if (inline) {
      return (
        <Button variant="outline" size="sm" onClick={openConnectModal}>
          <Wallet className="h-4 w-4 mr-2" />
          Connect Wallet
        </Button>
      );
    }
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Wallet Required</CardTitle>
          </div>
          <CardDescription>
            Connect your wallet to access this feature
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={openConnectModal}>
            <Wallet className="h-4 w-4 mr-2" />
            Connect Wallet
          </Button>
        </CardContent>
      </Card>
    );
  }

  // No capability
  if (!hasCapability) {
    if (fallback) {
      return <>{fallback}</>;
    }
    if (inline) {
      return (
        <Badge variant="destructive" className="gap-1">
          <ShieldX className="h-3 w-3" />
          Requires {capabilityName}
        </Badge>
      );
    }
    return (
      <Card className="border-destructive/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldX className="h-5 w-5 text-destructive" />
            <CardTitle>Access Denied</CardTitle>
          </div>
          <CardDescription>
            You don&apos;t have permission to perform this action
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Required capability:</span>
            <Badge variant="outline">{capabilityName}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Contact an administrator to request the{" "}
            <code className="bg-muted px-1 py-0.5 rounded">{capabilityName}</code>{" "}
            capability for your wallet address.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Has capability - render children
  return <>{children}</>;
}

/**
 * Hook to check multiple capabilities at once
 */
export function useRequiredCapabilities(capabilities: CapabilityHash[]) {
  const { address, isConnected } = useAccount();

  // Check each capability individually
  const capabilityChecks = capabilities.map((cap) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useCapabilityGate(address, cap);
  });

  const isLoading = capabilityChecks.some((check) => check.isLoading);
  const hasAllCapabilities = capabilityChecks.every((check) => check.hasCapability);
  const missingCapabilities = capabilities.filter(
    (_, index) => !capabilityChecks[index].hasCapability
  );

  return {
    isConnected,
    isLoading,
    hasAllCapabilities,
    missingCapabilities,
    capabilityNames: missingCapabilities.map((cap) => CapabilityNames[cap] || "Unknown"),
  };
}

// Re-export Capabilities for convenience
export { Capabilities };
