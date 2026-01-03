"use client";

import { Badge } from "./badge";
import { cn } from "../lib/utils";
import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";

export type ResolutionType = "CLEAR" | "QUARANTINE" | "DECOMMISSION";

const resolutionConfig: Record<
  ResolutionType,
  { label: string; className: string; icon: typeof CheckCircle }
> = {
  CLEAR: {
    label: "Cleared",
    className: "bg-green-500/10 text-green-600 border-green-500/20",
    icon: CheckCircle,
  },
  QUARANTINE: {
    label: "Quarantined",
    className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    icon: AlertTriangle,
  },
  DECOMMISSION: {
    label: "Decommissioned",
    className: "bg-red-500/10 text-red-600 border-red-500/20",
    icon: XCircle,
  },
};

export interface ResolutionBadgeProps {
  resolution: ResolutionType | number;
  showIcon?: boolean;
  className?: string;
}

export function ResolutionBadge({
  resolution,
  showIcon = true,
  className,
}: ResolutionBadgeProps) {
  // Convert number to string if needed
  const resolutionKey: ResolutionType =
    typeof resolution === "number"
      ? (["CLEAR", "QUARANTINE", "DECOMMISSION"][resolution] as ResolutionType)
      : resolution;

  const config = resolutionConfig[resolutionKey] ?? resolutionConfig.CLEAR;
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      {showIcon && <Icon className="h-3 w-3 mr-1" />}
      {config.label}
    </Badge>
  );
}

export function getResolutionLabel(resolution: ResolutionType | number): string {
  const key =
    typeof resolution === "number"
      ? (["CLEAR", "QUARANTINE", "DECOMMISSION"][resolution] as ResolutionType)
      : resolution;
  return resolutionConfig[key]?.label ?? "Unknown";
}
