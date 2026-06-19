"use client";

import { cn } from "@tagit/ui";

/** All / Mine pill toggle with shared a11y wiring (used by Products and Agents). */
export function ScopeToggle({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-2">
      <button
        type="button"
        aria-pressed={!value}
        onClick={() => onChange(false)}
        className={cn(
          "px-3 py-1.5 rounded-full text-sm font-medium",
          !value
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-secondary-foreground hover:bg-accent",
        )}
      >
        All
      </button>
      <button
        type="button"
        aria-pressed={value}
        onClick={() => onChange(true)}
        className={cn(
          "px-3 py-1.5 rounded-full text-sm font-medium",
          value
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-secondary-foreground hover:bg-accent",
        )}
      >
        Mine
      </button>
    </div>
  );
}
