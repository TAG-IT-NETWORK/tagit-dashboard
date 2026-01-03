"use client";

import { useState, useEffect } from "react";
import { cn } from "../lib/utils";
import { Clock } from "lucide-react";

export interface CountdownTimerProps {
  endTime: Date | number;
  showIcon?: boolean;
  onComplete?: () => void;
  className?: string;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

function calculateTimeRemaining(endTime: Date | number): TimeRemaining {
  const end = typeof endTime === "number" ? endTime : endTime.getTime();
  const total = Math.max(0, end - Date.now());

  const seconds = Math.floor((total / 1000) % 60);
  const minutes = Math.floor((total / 1000 / 60) % 60);
  const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
  const days = Math.floor(total / (1000 * 60 * 60 * 24));

  return { days, hours, minutes, seconds, total };
}

export function CountdownTimer({
  endTime,
  showIcon = true,
  onComplete,
  className,
}: CountdownTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>(() =>
    calculateTimeRemaining(endTime)
  );

  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = calculateTimeRemaining(endTime);
      setTimeRemaining(remaining);

      if (remaining.total <= 0) {
        clearInterval(timer);
        onComplete?.();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [endTime, onComplete]);

  if (timeRemaining.total <= 0) {
    return (
      <div className={cn("flex items-center gap-1 text-muted-foreground", className)}>
        {showIcon && <Clock className="h-4 w-4" />}
        <span>Ended</span>
      </div>
    );
  }

  const parts: string[] = [];
  if (timeRemaining.days > 0) {
    parts.push(`${timeRemaining.days}d`);
  }
  if (timeRemaining.hours > 0 || timeRemaining.days > 0) {
    parts.push(`${timeRemaining.hours}h`);
  }
  if (timeRemaining.minutes > 0 || timeRemaining.hours > 0 || timeRemaining.days > 0) {
    parts.push(`${timeRemaining.minutes}m`);
  }
  parts.push(`${timeRemaining.seconds}s`);

  const isUrgent = timeRemaining.total < 1000 * 60 * 60; // Less than 1 hour

  return (
    <div
      className={cn(
        "flex items-center gap-1 font-mono",
        isUrgent ? "text-red-600" : "text-foreground",
        className
      )}
    >
      {showIcon && <Clock className="h-4 w-4" />}
      <span>{parts.join(" ")}</span>
    </div>
  );
}
