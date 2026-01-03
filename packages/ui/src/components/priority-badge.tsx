"use client";

import { Badge } from "./badge";
import { cn } from "../lib/utils";
import { AlertTriangle, AlertCircle, Info } from "lucide-react";

export type Priority = "HIGH" | "MEDIUM" | "LOW";

const priorityConfig: Record<
  Priority,
  { label: string; className: string; icon: typeof AlertTriangle }
> = {
  HIGH: {
    label: "High",
    className: "bg-red-500/10 text-red-600 border-red-500/20",
    icon: AlertTriangle,
  },
  MEDIUM: {
    label: "Medium",
    className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    icon: AlertCircle,
  },
  LOW: {
    label: "Low",
    className: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    icon: Info,
  },
};

export interface PriorityBadgeProps {
  priority: Priority;
  showIcon?: boolean;
  className?: string;
}

export function PriorityBadge({
  priority,
  showIcon = true,
  className,
}: PriorityBadgeProps) {
  const config = priorityConfig[priority] ?? priorityConfig.LOW;
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      {showIcon && <Icon className="h-3 w-3 mr-1" />}
      {config.label}
    </Badge>
  );
}

/**
 * Calculate priority based on time since flagged
 * HIGH: > 48 hours
 * MEDIUM: > 24 hours
 * LOW: <= 24 hours
 */
export function calculatePriority(flaggedAt: number | Date): Priority {
  const flagTime = typeof flaggedAt === "number" ? flaggedAt : flaggedAt.getTime();
  const hoursOpen = (Date.now() - flagTime) / (1000 * 60 * 60);

  if (hoursOpen > 48) return "HIGH";
  if (hoursOpen > 24) return "MEDIUM";
  return "LOW";
}

/**
 * Format duration since flagged
 */
export function formatTimeOpen(flaggedAt: number | Date): string {
  const flagTime = typeof flaggedAt === "number" ? flaggedAt : flaggedAt.getTime();
  const ms = Date.now() - flagTime;

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}
