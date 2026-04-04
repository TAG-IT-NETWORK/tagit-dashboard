"use client";

import { ConnectButton, Badge } from "@tagit/ui";
import { useCurrentUser } from "@tagit/auth";
import { Bell, Menu } from "lucide-react";
import { ChainSelector } from "./chain-selector";

interface HeaderProps {
  /** Called when the hamburger button is pressed (mobile only). */
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { badges, isConnected, isLoading } = useCurrentUser();

  return (
    <header className="flex items-center justify-between h-16 px-4 md:px-6 border-b border-border bg-card flex-shrink-0">
      <div className="flex items-center gap-3 md:gap-4">
        {/* Hamburger — visible only below md breakpoint */}
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-semibold text-foreground">Admin Console</h2>
        <ChainSelector />
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
