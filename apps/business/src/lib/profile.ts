"use client";

import { useCallback, useEffect, useState } from "react";

export interface BusinessProfile {
  name: string;
  type: "manufacturer" | "retailer" | "brand" | "recycler" | "other";
  website?: string;
  createdAt: number;
}

const STORAGE_KEY = "tagit-business-profile";

function readLocal(): BusinessProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as BusinessProfile) : null;
  } catch {
    return null;
  }
}

function writeLocal(p: BusinessProfile | null): void {
  if (typeof window === "undefined") return;
  if (p) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  else window.localStorage.removeItem(STORAGE_KEY);
}

/** Read the non-HttpOnly tagit_csrf cookie for the double-submit header. */
function csrfToken(): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(/(?:^|;\s*)tagit_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

type ServerAccount = { name: string; type: BusinessProfile["type"]; website?: string | null };

function toProfile(a: ServerAccount, createdAt: number): BusinessProfile | null {
  if (!a.name) return null; // empty name = account exists but not onboarded yet
  return { name: a.name, type: a.type, website: a.website ?? undefined, createdAt };
}

async function postAccount(
  p: Omit<BusinessProfile, "createdAt">,
): Promise<BusinessProfile | null> {
  try {
    const res = await fetch("/api/auth/account", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": csrfToken() },
      body: JSON.stringify({ name: p.name, type: p.type, website: p.website }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) return null;
    return toProfile(data.account as ServerAccount, Date.now());
  } catch {
    return null;
  }
}

/**
 * Business profile — server-persisted per account (multi-device) via /api/auth/me +
 * /api/auth/account, with a localStorage mirror so the existing app-shell gate keeps
 * working and a one-time migration of any pre-existing localStorage profile. The
 * wallet remains the on-chain identity; this is display/onboarding metadata.
 */
export function useBusinessProfile() {
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const local = readLocal();
    if (local) setProfile(local); // optimistic: show the mirror immediately

    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data?.ok && data.account) {
            let server = toProfile(data.account as ServerAccount, Date.now());
            // One-time migration: push a pre-existing local profile into the empty account.
            if (!server && local) server = await postAccount(local);
            if (!cancelled) {
              setProfile(server);
              writeLocal(server);
            }
          }
        }
        // 401 (no session yet) → keep the local mirror; the user signs in via SIWE.
      } catch {
        /* offline / services down → keep the local mirror */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(async (next: Omit<BusinessProfile, "createdAt">) => {
    const server = await postAccount(next);
    const value: BusinessProfile = server ?? {
      ...next,
      createdAt: readLocal()?.createdAt ?? Date.now(),
    };
    writeLocal(value);
    setProfile(value);
  }, []);

  const clear = useCallback(() => {
    writeLocal(null);
    setProfile(null);
  }, []);

  return { profile, loaded, save, clear };
}
