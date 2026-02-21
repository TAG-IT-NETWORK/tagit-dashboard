"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@tagit/ui";
import {
  LayoutDashboard,
  Package,
  Users,
  BadgeCheck,
  Shield,
  AlertTriangle,
  Vote,
  Wallet,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  Bot,
  Megaphone,
} from "lucide-react";
import { useState } from "react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Assets", href: "/assets", icon: Package },
  { name: "Users", href: "/users", icon: Users },
  { name: "Badges", href: "/badges", icon: BadgeCheck },
  { name: "Capabilities", href: "/capabilities", icon: Shield },
  { name: "Resolve", href: "/resolve", icon: AlertTriangle },
  { name: "Governance", href: "/governance", icon: Vote },
  { name: "Treasury", href: "/treasury", icon: Wallet },
  { name: "BD Agent", href: "/adagent", icon: Bot },
  { name: "Influencer", href: "/influencer", icon: Megaphone },
];

// Testing section - only visible in development
const testingNavigation = [
  { name: "Lifecycle Test", href: "/test/lifecycle", icon: FlaskConical },
];

const isDev = process.env.NODE_ENV === "development";

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-card border-r border-border transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-border">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">T</span>
            </div>
            <span className="font-semibold text-lg">TAG IT Admin</span>
          </Link>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center mx-auto">
            <span className="text-primary-foreground font-bold text-sm">T</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                collapsed && "justify-center"
              )}
              title={collapsed ? item.name : undefined}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          );
        })}

        {/* Testing Section - Dev Only */}
        {isDev && (
          <>
            <div className="pt-4 pb-2">
              {!collapsed && (
                <span className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Testing
                </span>
              )}
              {collapsed && <div className="border-t border-border mx-3" />}
            </div>
            {testingNavigation.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    collapsed && "justify-center"
                  )}
                  title={collapsed ? item.name : undefined}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  {!collapsed && <span>{item.name}</span>}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* Collapse Toggle */}
      <div className="p-2 border-t border-border">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <>
              <ChevronLeft className="h-5 w-5 mr-2" />
              <span className="text-sm">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
