"use client";

import { type ReactNode, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Suppress MetaMask wallet detection errors in development
// These occur when RainbowKit detects wallets before connection
if (typeof window !== "undefined") {
  const originalError = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    const msg = String(message).toLowerCase();
    // Suppress common wallet detection errors
    if (
      msg.includes("metamask") ||
      msg.includes("failed to connect") ||
      (source && source.includes("chrome-extension"))
    ) {
      console.debug("[Wallet Detection]", message);
      return true; // Prevent default error handling
    }
    return originalError ? originalError(message, source, lineno, colno, error) : false;
  };

  // Also handle unhandled promise rejections from wallet detection
  window.addEventListener("unhandledrejection", (event) => {
    const reason = String(event.reason?.message || event.reason || "").toLowerCase();
    if (
      reason.includes("metamask") ||
      reason.includes("failed to connect") ||
      reason.includes("user rejected")
    ) {
      console.debug("[Wallet Detection]", event.reason);
      event.preventDefault();
    }
  });
}

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
