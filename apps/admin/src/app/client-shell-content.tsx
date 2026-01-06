"use client";

import { type ReactNode } from "react";
import { AppProviders } from "./providers";
import { AdminShell } from "@/components/admin-shell";

export function ClientShellContent({ children }: { children: ReactNode }) {
  return (
    <AppProviders>
      <AdminShell>{children}</AdminShell>
    </AppProviders>
  );
}
