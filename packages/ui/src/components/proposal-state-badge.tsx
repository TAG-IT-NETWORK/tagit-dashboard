"use client";

import { Badge } from "./badge";
import { cn } from "../lib/utils";
import {
  Clock,
  Play,
  CheckCircle,
  XCircle,
  Timer,
  Rocket,
  Ban,
} from "lucide-react";

export type ProposalState =
  | "PENDING"
  | "ACTIVE"
  | "CANCELED"
  | "DEFEATED"
  | "SUCCEEDED"
  | "QUEUED"
  | "EXPIRED"
  | "EXECUTED";

const stateConfig: Record<
  ProposalState,
  { label: string; className: string; icon: typeof Clock }
> = {
  PENDING: {
    label: "Pending",
    className: "bg-gray-500/10 text-gray-600 border-gray-500/20",
    icon: Clock,
  },
  ACTIVE: {
    label: "Active",
    className: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    icon: Play,
  },
  CANCELED: {
    label: "Canceled",
    className: "bg-gray-500/10 text-gray-600 border-gray-500/20",
    icon: Ban,
  },
  DEFEATED: {
    label: "Defeated",
    className: "bg-red-500/10 text-red-600 border-red-500/20",
    icon: XCircle,
  },
  SUCCEEDED: {
    label: "Succeeded",
    className: "bg-green-500/10 text-green-600 border-green-500/20",
    icon: CheckCircle,
  },
  QUEUED: {
    label: "Queued",
    className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    icon: Timer,
  },
  EXPIRED: {
    label: "Expired",
    className: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    icon: Clock,
  },
  EXECUTED: {
    label: "Executed",
    className: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    icon: Rocket,
  },
};

export interface ProposalStateBadgeProps {
  state: ProposalState | number;
  showIcon?: boolean;
  className?: string;
}

const stateFromNumber: ProposalState[] = [
  "PENDING",
  "ACTIVE",
  "CANCELED",
  "DEFEATED",
  "SUCCEEDED",
  "QUEUED",
  "EXPIRED",
  "EXECUTED",
];

export function ProposalStateBadge({
  state,
  showIcon = true,
  className,
}: ProposalStateBadgeProps) {
  const stateKey: ProposalState =
    typeof state === "number" ? stateFromNumber[state] ?? "PENDING" : state;

  const config = stateConfig[stateKey] ?? stateConfig.PENDING;
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      {showIcon && <Icon className="h-3 w-3 mr-1" />}
      {config.label}
    </Badge>
  );
}

export function getProposalStateLabel(state: ProposalState | number): string {
  const key =
    typeof state === "number" ? stateFromNumber[state] ?? "PENDING" : state;
  return stateConfig[key]?.label ?? "Unknown";
}
