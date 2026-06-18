"use client";

import { type ReactNode, useState, useEffect } from "react";

interface WagmiGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
}

function DefaultFallback() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <p className="text-muted-foreground">Loading...</p>
    </div>
  );
}

/**
 * WagmiGuard ensures children are only rendered after client-side mount.
 * This prevents hydration issues with wagmi hooks in Next.js App Router.
 */
export function WagmiGuard({ children, fallback }: WagmiGuardProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return fallback ?? <DefaultFallback />;
  }

  return <>{children}</>;
}
