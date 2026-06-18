"use client";

import { useCallback, useEffect, useState } from "react";

export interface BusinessProfile {
  name: string;
  type: "manufacturer" | "retailer" | "brand" | "recycler" | "other";
  website?: string;
  createdAt: number;
}

const STORAGE_KEY = "tagit-business-profile";

function readProfile(): BusinessProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as BusinessProfile) : null;
  } catch {
    return null;
  }
}

/**
 * Business profile persisted in localStorage, keyed per browser.
 * On-chain identity stays in the wallet; this is display metadata only.
 */
export function useBusinessProfile() {
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setProfile(readProfile());
    setLoaded(true);
  }, []);

  const save = useCallback((next: Omit<BusinessProfile, "createdAt">) => {
    const value: BusinessProfile = {
      ...next,
      createdAt: readProfile()?.createdAt ?? Date.now(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    setProfile(value);
  }, []);

  const clear = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setProfile(null);
  }, []);

  return { profile, loaded, save, clear };
}
