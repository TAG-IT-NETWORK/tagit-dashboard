"use client";

import { type ReactNode, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Loading screen component
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

// Dynamically import the content that uses wagmi
const ClientShellContent = dynamic(
  () => import("./client-shell-content").then((mod) => mod.ClientShellContent),
  {
    ssr: false,
    loading: () => <LoadingScreen />,
  }
);

export function ClientShell({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render until we're definitely on the client
  if (!mounted) {
    return <LoadingScreen />;
  }

  return <ClientShellContent>{children}</ClientShellContent>;
}
