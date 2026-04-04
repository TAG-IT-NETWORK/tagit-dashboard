"use client";

import { type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppProviders } from "./providers";
import { AdminShell } from "@/components/admin-shell";
import { Toaster } from "@tagit/ui";

export function ClientShellContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // Login page renders standalone — no wagmi/RainbowKit providers needed
  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <AppProviders>
      <Toaster>
        <AdminShell>{children}</AdminShell>
      </Toaster>
    </AppProviders>
  );
}
