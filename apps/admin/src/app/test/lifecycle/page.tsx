"use client";

import { WagmiGuard } from "@/components/wagmi-guard";
import { LifecycleContent } from "./lifecycle-content";
import { Loader2 } from "lucide-react";

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-muted-foreground">Loading lifecycle test...</p>
    </div>
  );
}

export default function LifecycleTestPage() {
  return (
    <WagmiGuard fallback={<LoadingState />}>
      <LifecycleContent />
    </WagmiGuard>
  );
}
