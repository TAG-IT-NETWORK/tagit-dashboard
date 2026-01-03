// Components
export { Button, buttonVariants, type ButtonProps } from "./components/button";
export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from "./components/card";
export { Input, type InputProps } from "./components/input";
export { Label } from "./components/label";
export { Badge, badgeVariants, type BadgeProps } from "./components/badge";
export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./components/dialog";
export { ConnectButton, type ConnectButtonProps } from "./components/connect-button";
export { MetricCard, type MetricCardProps } from "./components/metric-card";
export { StateBadge, getStateLabel, getStateColor, type StateBadgeProps } from "./components/state-badge";
export { AddressBadge, type AddressBadgeProps } from "./components/address-badge";

// Phase 3 Components
export {
  ResolutionBadge,
  getResolutionLabel,
  type ResolutionType,
  type ResolutionBadgeProps,
} from "./components/resolution-badge";
export {
  ProposalStateBadge,
  getProposalStateLabel,
  type ProposalState,
  type ProposalStateBadgeProps,
} from "./components/proposal-state-badge";
export { VoteBar, type VoteBarProps } from "./components/vote-bar";
export { CountdownTimer, type CountdownTimerProps } from "./components/countdown-timer";
export {
  PriorityBadge,
  calculatePriority,
  formatTimeOpen,
  type Priority,
  type PriorityBadgeProps,
} from "./components/priority-badge";

// Utils
export { cn } from "./lib/utils";
