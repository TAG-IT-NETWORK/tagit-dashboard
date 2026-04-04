"use client";

import Link from "next/link";
import Image from "next/image";
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
  BrainCircuit,
  Megaphone,
  Play,
  X,
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
  { name: "AI Agents", href: "/agents", icon: BrainCircuit },
  { name: "BD Agent", href: "/adagent", icon: Bot },
  { name: "Influencer", href: "/influencer", icon: Megaphone },
  { name: "Demo", href: "/demo", icon: Play },
];

// Testing section
const testingNavigation = [{ name: "Lifecycle Test", href: "/test/lifecycle", icon: FlaskConical }];

interface SidebarProps {
  /** Controls whether the drawer is open on mobile (below md breakpoint). */
  mobileOpen?: boolean;
  /** Called when the mobile drawer should close (backdrop click or close button). */
  onMobileClose?: () => void;
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Shared nav content so we can reuse it in both the desktop sidebar and the
  // mobile drawer without duplicating markup.
  function NavContent({ isDrawer = false }: { isDrawer?: boolean }) {
    return (
      <>
        {/* Logo */}
        <div className="flex items-center h-16 px-4 border-b border-border flex-shrink-0">
          {(!collapsed || isDrawer) && (
            <Link
              href="/dashboard"
              className="flex items-center gap-2"
              onClick={isDrawer ? onMobileClose : undefined}
            >
              <Image src="/tagit_logo.png" alt="TAG IT" width={32} height={32} className="invert" />
              <span className="font-semibold text-lg">TAG IT Admin</span>
            </Link>
          )}
          {collapsed && !isDrawer && (
            <Link href="/dashboard" className="mx-auto">
              <Image src="/tagit_logo.png" alt="TAG IT" width={32} height={32} className="invert" />
            </Link>
          )}
          {/* Close button — drawer only */}
          {isDrawer && (
            <button
              onClick={onMobileClose}
              className="ml-auto p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
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
                onClick={isDrawer ? onMobileClose : undefined}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  collapsed && !isDrawer && "justify-center",
                )}
                title={collapsed && !isDrawer ? item.name : undefined}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {(!collapsed || isDrawer) && <span>{item.name}</span>}
              </Link>
            );
          })}

          {/* Testing Section */}
          <div className="pt-4 pb-2">
            {(!collapsed || isDrawer) && (
              <span className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Testing
              </span>
            )}
            {collapsed && !isDrawer && <div className="border-t border-border mx-3" />}
          </div>
          {testingNavigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={isDrawer ? onMobileClose : undefined}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  collapsed && !isDrawer && "justify-center",
                )}
                title={collapsed && !isDrawer ? item.name : undefined}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {(!collapsed || isDrawer) && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Collapse Toggle — desktop only */}
        {!isDrawer && (
          <div className="p-2 border-t border-border flex-shrink-0">
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
        )}
      </>
    );
  }

  return (
    <>
      {/* ── Desktop sidebar (md and above) ─────────────────────────────── */}
      <aside
        className={cn(
          "hidden md:flex flex-col h-screen bg-card border-r border-border transition-all duration-300 flex-shrink-0",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <NavContent />
      </aside>

      {/* ── Mobile drawer (below md) ────────────────────────────────────── */}
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 md:hidden",
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
        aria-hidden="true"
        onClick={onMobileClose}
      />

      {/* Drawer panel */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col w-72 bg-card border-r border-border transition-transform duration-300 md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <NavContent isDrawer />
      </aside>
    </>
  );
}
