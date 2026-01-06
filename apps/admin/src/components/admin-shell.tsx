"use client";

import { type ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";

interface AdminShellProps {
  children: ReactNode;
}

// Development mode: Skip wallet authentication for now
// TODO: Re-enable wallet auth when wagmi context issue is resolved
export function AdminShell({ children }: AdminShellProps) {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
