"use client";

import * as React from "react";
import { createContext, useCallback, useRef, useState } from "react";
import { X, CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "../lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration: number;
}

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** Auto-dismiss duration in ms. Pass 0 to disable. Default: 5000 */
  duration?: number;
}

export interface ToastContextValue {
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

export const ToastContext = createContext<ToastContextValue | null>(null);

// ─── Internal single toast item ───────────────────────────────────────────────

const variantStyles: Record<ToastVariant, string> = {
  success: "border-green-500/40 bg-green-950/90 text-green-100",
  error: "border-red-500/40 bg-red-950/90 text-red-100",
  warning: "border-yellow-500/40 bg-yellow-950/90 text-yellow-100",
  info: "border-blue-500/40 bg-blue-950/90 text-blue-100",
};

const iconStyles: Record<ToastVariant, string> = {
  success: "text-green-400",
  error: "text-red-400",
  warning: "text-yellow-400",
  info: "text-blue-400",
};

const variantIcons: Record<ToastVariant, React.ReactElement> = {
  success: <CheckCircle2 className="h-4 w-4 shrink-0" />,
  error: <XCircle className="h-4 w-4 shrink-0" />,
  warning: <AlertTriangle className="h-4 w-4 shrink-0" />,
  info: <Info className="h-4 w-4 shrink-0" />,
};

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const [visible, setVisible] = useState(false);

  // Animate in on mount
  React.useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    // Allow fade-out before removing
    setTimeout(() => onDismiss(toast.id), 200);
  }, [onDismiss, toast.id]);

  // Auto-dismiss
  React.useEffect(() => {
    if (toast.duration === 0) return;
    const timer = setTimeout(handleDismiss, toast.duration);
    return () => clearTimeout(timer);
  }, [toast.duration, handleDismiss]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className={cn(
        "pointer-events-auto flex w-full items-start gap-3 rounded-lg border px-4 py-3 shadow-lg",
        "transition-all duration-200 ease-out",
        visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
        variantStyles[toast.variant],
      )}
    >
      {/* Icon */}
      <span className={cn("mt-0.5", iconStyles[toast.variant])}>{variantIcons[toast.variant]}</span>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight">{toast.title}</p>
        {toast.description && <p className="mt-0.5 text-xs opacity-80">{toast.description}</p>}
      </div>

      {/* Dismiss button */}
      <button
        type="button"
        onClick={handleDismiss}
        className="mt-0.5 shrink-0 rounded-sm opacity-60 transition-opacity hover:opacity-100 focus:outline-none focus:ring-1 focus:ring-current"
        aria-label="Dismiss notification"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Provider (exported for use in Toaster) ──────────────────────────────────

interface ToastProviderProps {
  children: React.ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const toast = useCallback((options: ToastOptions): string => {
    const id = `toast-${++counterRef.current}`;
    const entry: Toast = {
      id,
      title: options.title,
      description: options.description,
      variant: options.variant ?? "info",
      duration: options.duration ?? 5000,
    };
    setToasts((prev) => [...prev, entry]);
    return id;
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      {/* Viewport — fixed bottom-right, rendered inside the provider so it
          stays above everything without a separate portal setup */}
      <div
        aria-label="Notifications"
        className="pointer-events-none fixed bottom-4 right-4 z-[9999] flex w-80 flex-col gap-2"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
