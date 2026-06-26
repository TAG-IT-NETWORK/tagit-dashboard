"use client";

import { type ReactNode } from "react";
import { AppProviders } from "./providers";
import { AdminShell } from "@/components/admin-shell";
import { Toaster } from "@tagit/ui";

export function ClientShellContent({ children }: { children: ReactNode }) {
  return (
    <AppProviders>
      <Toaster>
        <AdminShell>{children}</AdminShell>
      </Toaster>
    </AppProviders>
  );
}
