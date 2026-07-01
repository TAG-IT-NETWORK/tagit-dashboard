"use client";

import { useCallback, useEffect, useState } from "react";

// Base Sepolia test USDC (6 decimals) + the treasury that must receive the top-up.
// The treasury MUST match the services BILLING_TREASURY / SALE_TREASURY, or the
// server rejects the payment. Price MUST match the server BILLING_TOPUP_USDC.
export const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;
export const USDC_DECIMALS = 6;
export const BILLING_TREASURY = (process.env.NEXT_PUBLIC_SALE_TREASURY ??
  "0x458B4d0c3a55006965Fd13D6af7B8509De51Cb3D") as `0x${string}`;
export const TOPUP_USDC = Number(process.env.NEXT_PUBLIC_BILLING_TOPUP_USDC ?? "10");
export const BASE_SEPOLIA = 84532;

export interface Billing {
  plan: "free" | "usdc";
  freeQuota: number;
  claimsUsed: number;
}

/** Read the non-HttpOnly tagit_csrf cookie for the double-submit header. */
function csrfToken(): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(/(?:^|;\s*)tagit_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

export function topupPriceUnits(): bigint {
  const safe = Number.isFinite(TOPUP_USDC) && TOPUP_USDC > 0 ? TOPUP_USDC : 10;
  return BigInt(Math.round(safe * 10 ** USDC_DECIMALS));
}

type RedeemResult = { ok: true; plan: "usdc" } | { ok: false; error: string };

/**
 * Account billing state — the paid half of free-first-5. Reads plan + quota from
 * the server session (/api/auth/me) and exposes redeem(txHash), which posts a
 * confirmed USDC payment to /api/billing/redeem (same-origin proxy → services).
 */
export function useBilling() {
  const [billing, setBilling] = useState<Billing | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      if (data?.ok && data.account) {
        const a = data.account as Partial<Billing>;
        setBilling({
          plan: a.plan === "usdc" ? "usdc" : "free",
          freeQuota: typeof a.freeQuota === "number" ? a.freeQuota : 5,
          claimsUsed: typeof a.claimsUsed === "number" ? a.claimsUsed : 0,
        });
      }
    } catch {
      /* offline / not signed in — leave billing null */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void refresh().finally(() => {
      if (!cancelled) setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const redeem = useCallback(
    async (txHash: string): Promise<RedeemResult> => {
      try {
        const res = await fetch("/api/billing/redeem", {
          method: "POST",
          headers: { "content-type": "application/json", "x-csrf-token": csrfToken() },
          body: JSON.stringify({ txHash }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) {
          return { ok: false, error: data?.error ?? `redeem failed (${res.status})` };
        }
        await refresh();
        return { ok: true, plan: "usdc" };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "network error" };
      }
    },
    [refresh],
  );

  const remaining =
    billing && billing.plan === "free" ? Math.max(0, billing.freeQuota - billing.claimsUsed) : null;

  return { billing, loaded, remaining, redeem, refresh };
}
