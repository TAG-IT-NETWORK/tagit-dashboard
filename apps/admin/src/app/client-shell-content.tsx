"use client";

import { type ReactNode } from "react";
import { AppProviders } from "./providers";
import { AdminShell } from "@/components/admin-shell";
import { Toaster } from "@tagit/ui";

export function ClientShellContent({
  children,
  tenant = null,
  actingBrand = null,
}: {
  children: ReactNode;
  tenant?: string | null;
  actingBrand?: string | null;
}) {
  return (
    <AppProviders>
      <Toaster>
        <AdminShell tenant={tenant} actingBrand={actingBrand}>
          {children}
        </AdminShell>
      </Toaster>
    </AppProviders>
  );
}
