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
  Coins,
  Factory,
  UsersRound,
  BookOpen,
  Nfc,
} from "lucide-react";
import { useState } from "react";

import type { LucideIcon } from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  /** Extra "active" rule beyond the href prefix (e.g. the station lives under /catalog). */
  match?: (pathname: string) => boolean;
}

interface NavGroup {
  name: string;
  /** Tailwind bg-* class for the section dot. */
  dot: string;
  /** Tailwind border-* class for the active-item accent bar. */
  accent: string;
  items: NavItem[];
  /** Testing / scratch tools — rendered dimmed. */
  muted?: boolean;
}

/**
 * Sidebar groups. The physical/hardware workflow comes first because it is
 * what an operator does every day (catalog → batch → binding station);
 * governance, AI and testing tools are separated so they stop hiding it.
 */
export const NAV_GROUPS: ReadonlyArray<NavGroup> = [
  {
    name: "Operations",
    dot: "bg-emerald-500",
    accent: "border-emerald-500",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      {
        name: "Binding Station",
        href: "/station",
        icon: Nfc,
        match: (pathname) => pathname.includes("/batch/bind"),
      },
      { name: "Catalog", href: "/catalog", icon: BookOpen },
      { name: "Assets", href: "/assets", icon: Package },
      { name: "Assembly Line", href: "/assembly-line", icon: Factory },
    ],
  },
  {
    name: "Identity & Access",
    dot: "bg-sky-500",
    accent: "border-sky-500",
    items: [
      { name: "Users", href: "/users", icon: Users },
      { name: "Badges", href: "/badges", icon: BadgeCheck },
      { name: "Capabilities", href: "/capabilities", icon: Shield },
      // META-T32: admin_users roster CRUD. Visible to everyone; the role
      // middleware sends non-admins to /403.
      { name: "Team", href: "/team", icon: UsersRound },
    ],
  },
  {
    name: "Token & Governance",
    dot: "bg-violet-500",
    accent: "border-violet-500",
    items: [
      { name: "Governance", href: "/governance", icon: Vote },
      { name: "Treasury", href: "/treasury", icon: Wallet },
      { name: "Tokenomics", href: "/tokenomics", icon: Coins },
      { name: "Resolve", href: "/resolve", icon: AlertTriangle },
    ],
  },
  {
    name: "AI & Analytics",
    dot: "bg-amber-500",
    accent: "border-amber-500",
    items: [
      { name: "AI Agents", href: "/agents", icon: BrainCircuit },
      { name: "BD Agent", href: "/adagent", icon: Bot },
      { name: "Influencer", href: "/influencer", icon: Megaphone },
      { name: "Demo", href: "/demo", icon: Play },
    ],
  },
  {
    name: "Testing",
    dot: "bg-zinc-500",
    accent: "border-zinc-500",
    muted: true,
    items: [{ name: "Lifecycle Console", href: "/test/console", icon: FlaskConical }],
  },
];

function isItemActive(item: NavItem, pathname: string): boolean {
  if (pathname === item.href || pathname.startsWith(`${item.href}/`)) return true;
  return item.match ? item.match(pathname) : false;
}

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

        {/* Navigation — grouped by workflow, color-coded per group */}
        <nav className="flex-1 px-2 py-3 overflow-y-auto">
          {NAV_GROUPS.map((group, gi) => {
            const groupActive = group.items.some((item) => isItemActive(item, pathname));
            return (
              <div key={group.name} className={cn(gi > 0 && "mt-4", group.muted && "opacity-70")}>
                {!collapsed || isDrawer ? (
                  <div className="flex items-center gap-2 px-3 pb-1.5">
                    <span className={cn("h-1.5 w-1.5 rounded-full", group.dot)} aria-hidden="true" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {group.name}
                    </span>
                  </div>
                ) : (
                  <div className="mx-3 mb-2 flex items-center justify-center" title={group.name}>
                    <span
                      className={cn(
                        "h-1.5 w-6 rounded-full",
                        groupActive ? group.dot : "bg-border",
                      )}
                      aria-hidden="true"
                    />
                  </div>
                )}
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = isItemActive(item, pathname);
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={isDrawer ? onMobileClose : undefined}
                        className={cn(
                          "flex items-center gap-3 rounded-lg border-l-2 px-3 py-2 text-sm font-medium transition-colors",
                          isActive
                            ? cn("bg-primary/10 text-primary", group.accent)
                            : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
                          collapsed && !isDrawer && "justify-center",
                        )}
                        title={collapsed && !isDrawer ? item.name : undefined}
                      >
                        <item.icon className="h-5 w-5 flex-shrink-0" />
                        {(!collapsed || isDrawer) && <span>{item.name}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
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
