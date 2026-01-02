"use client";

import { ConnectButton, Badge } from "@tagit/ui";
import { useCurrentUser } from "@tagit/auth";
import { Bell } from "lucide-react";

export function Header() {
  const { badges, isConnected, isLoading } = useCurrentUser();

  return (
    <header className="flex items-center justify-between h-16 px-6 border-b border-border bg-card">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold text-foreground">Admin Console</h2>
      </div>

      <div className="flex items-center gap-4">
        {/* Badge Display */}
        {isConnected && !isLoading && badges.length > 0 && (
          <div className="flex items-center gap-2">
            {badges.map((badge) => (
              <Badge key={badge.id} variant="secondary" className="text-xs">
                {badge.name}
              </Badge>
            ))}
          </div>
        )}

        {/* Notifications */}
        <button className="relative p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
        </button>

        {/* Wallet Connect */}
        <ConnectButton />
      </div>
    </header>
  );
}
