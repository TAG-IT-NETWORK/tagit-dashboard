import { Badge } from "./badge";
import { cn } from "../lib/utils";

const stateConfig: Record<
  number,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className: string }
> = {
  0: { label: "Minted", variant: "secondary", className: "bg-gray-500/10 text-gray-500 border-gray-500/20" },
  1: { label: "Bound", variant: "secondary", className: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  2: { label: "Activated", variant: "secondary", className: "bg-green-500/10 text-green-500 border-green-500/20" },
  3: { label: "Claimed", variant: "secondary", className: "bg-purple-500/10 text-purple-500 border-purple-500/20" },
  4: { label: "Flagged", variant: "destructive", className: "bg-red-500/10 text-red-500 border-red-500/20" },
  5: { label: "Recycled", variant: "secondary", className: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
};

export interface StateBadgeProps {
  state: number;
  className?: string;
}

export function StateBadge({ state, className }: StateBadgeProps) {
  const config = stateConfig[state] ?? { label: `Unknown (${state})`, variant: "outline" as const, className: "" };

  return (
    <Badge variant={config.variant} className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
}

export function getStateLabel(state: number): string {
  return stateConfig[state]?.label ?? `Unknown (${state})`;
}

export function getStateColor(state: number): string {
  const colors: Record<number, string> = {
    0: "#6b7280", // gray
    1: "#3b82f6", // blue
    2: "#22c55e", // green
    3: "#a855f7", // purple
    4: "#ef4444", // red
    5: "#f97316", // orange
  };
  return colors[state] ?? "#6b7280";
}
