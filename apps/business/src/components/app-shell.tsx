"use client";

import { type ReactNode, type RefObject, useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { baseSepolia } from "@tagit/config";
import { Button, ConnectButton, cn } from "@tagit/ui";
import {
  Bot,
  GitBranch,
  LayoutDashboard,
  Menu,
  Network,
  Package,
  Settings,
  TrendingUp,
  Workflow,
  X,
} from "lucide-react";
import { WagmiGuard } from "./wagmi-guard";
import { useBusinessProfile } from "@/lib/profile";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/products", label: "Products", icon: Package },
  { href: "/lifecycle", label: "Lifecycle", icon: Workflow },
  { href: "/provenance", label: "Provenance", icon: GitBranch },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/mesh", label: "Agent Mesh", icon: Network },
  { href: "/metrics", label: "Network", icon: TrendingUp },
  { href: "/settings", label: "Settings", icon: Settings },
];

function BaseChainGuard({ children }: { children: ReactNode }) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();

  if (isConnected && chainId !== baseSepolia.id) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <h2 className="text-xl font-semibold">Wrong network</h2>
        <p className="text-muted-foreground max-w-sm">
          TAG IT Business runs on Base. Switch your wallet to Base Sepolia to continue.
        </p>
        <Button onClick={() => switchChain({ chainId: baseSepolia.id })} disabled={isPending}>
          {isPending ? "Switching..." : "Switch to Base"}
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}

function ConnectGate({ children }: { children: ReactNode }) {
  const { isConnected } = useAccount();
  const { profile, loaded } = useBusinessProfile();
  const router = useRouter();

  useEffect(() => {
    if (loaded && (!isConnected || !profile)) {
      router.replace("/");
    }
  }, [loaded, isConnected, profile, router]);

  if (!loaded || !isConnected || !profile) {
    return (
      <div
        role="status"
        aria-label="Connecting wallet"
        className="flex items-center justify-center min-h-[60vh]"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 px-3 py-4 space-y-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Mobile navigation as a modal dialog: Escape close, focus trap + return, body scroll lock. */
function MobileNav({
  open,
  onClose,
  triggerRef,
}: {
  open: boolean;
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement>;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtnRef.current?.focus();

    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab" && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      triggerRef.current?.focus();
    };
  }, [open, onClose, triggerRef]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className="absolute inset-y-0 left-0 flex w-64 flex-col border-r bg-background"
      >
        <div className="flex h-16 items-center justify-between border-b px-5">
          <div className="flex items-center gap-2">
            <Image src="/tagit_logo.png" alt="TAG IT" width={28} height={28} />
            <span className="font-semibold tracking-tight">TAG IT</span>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-secondary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <NavList onNavigate={onClose} />
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { profile } = useBusinessProfile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <div className="flex min-h-screen">
      <MobileNav open={mobileOpen} onClose={closeMobile} triggerRef={menuTriggerRef} />

      <aside className="hidden md:flex w-60 flex-col border-r bg-background fixed inset-y-0">
        <div className="flex items-center gap-3 px-5 h-16 border-b">
          <Image
            src="/tagit_logo.png"
            alt="TAG IT Network"
            width={32}
            height={32}
            className="rounded-md"
            priority
          />
          <div className="leading-tight">
            <div className="font-semibold tracking-tight">TAG IT</div>
            <div className="text-[11px] text-muted-foreground uppercase tracking-widest">
              Business
            </div>
          </div>
        </div>

        <NavList />

        <div className="px-5 py-4 border-t">
          {profile && (
            <div className="mb-3">
              <div className="text-sm font-medium truncate">{profile.name}</div>
              <div className="text-xs text-muted-foreground capitalize">{profile.type}</div>
            </div>
          )}
          <div className="text-[11px] text-muted-foreground">Built on Base</div>
        </div>
      </aside>

      <div className="flex-1 md:ml-60 flex flex-col">
        <header className="flex items-center justify-between h-16 px-6 border-b bg-background sticky top-0 z-10">
          <div className="md:hidden flex items-center gap-2">
            <button
              ref={menuTriggerRef}
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={mobileOpen}
              className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-secondary"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Image src="/tagit_logo.png" alt="TAG IT" width={28} height={28} />
            <span className="font-semibold">TAG IT Business</span>
          </div>
          <div className="hidden md:block" />
          <WagmiGuard
            fallback={<div className="h-10 w-36 rounded-lg bg-secondary animate-pulse" />}
          >
            <ConnectButton />
          </WagmiGuard>
        </header>

        <main className="flex-1 px-6 py-8 max-w-6xl w-full mx-auto">
          <WagmiGuard>
            <ConnectGate>
              <BaseChainGuard>{children}</BaseChainGuard>
            </ConnectGate>
          </WagmiGuard>
        </main>
      </div>
    </div>
  );
}
