"use client";

import { useState } from "react";
import { Button } from "@tagit/ui";
import { Building2 } from "lucide-react";

/**
 * Shown on every page while a platform admin is creating for a brand
 * (TAP-T16). Everything the catalog, batches and binding station show and
 * make is that brand's until this is stopped, so it must never be possible
 * to forget it is on.
 */
export function ActingBrandBanner({ brandId }: { brandId: string }) {
  const [stopping, setStopping] = useState(false);
  const [failed, setFailed] = useState(false);

  async function stop() {
    setStopping(true);
    setFailed(false);
    try {
      const res = await fetch("/api/brand-proxy/acting", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ businessId: null }),
      });
      if (!res.ok) throw new Error("not stopped");
      // Every page reads the choice on the server: load afresh.
      window.location.reload();
    } catch {
      setFailed(true);
      setStopping(false);
    }
  }

  return (
    <div
      role="status"
      data-acting-brand={brandId}
      className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/40 bg-amber-500/10 px-4 md:px-6 py-2 text-sm"
    >
      <span className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-amber-500" aria-hidden="true" />
        <span>
          Creating for brand <strong className="font-mono">{brandId}</strong>. You see this
          brand&apos;s products only, and what you make belongs to it.
        </span>
      </span>
      <span className="flex items-center gap-3">
        {failed && <span className="text-destructive">Could not stop. Try again.</span>}
        <Button size="sm" variant="outline" onClick={() => void stop()} disabled={stopping}>
          Stop
        </Button>
      </span>
    </div>
  );
}
