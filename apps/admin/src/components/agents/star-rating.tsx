"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@tagit/ui";

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  readonly?: boolean;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
} as const;

export function StarRating({ value, onChange, readonly = false, size = "md" }: StarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  const isInteractive = !readonly && onChange !== undefined;
  const displayValue = hovered !== null ? hovered : value;
  const iconClass = sizeClasses[size];

  return (
    <div
      className="inline-flex items-center gap-0.5"
      onMouseLeave={() => isInteractive && setHovered(null)}
      role={isInteractive ? "radiogroup" : undefined}
      aria-label={isInteractive ? "Star rating" : `Rating: ${value} out of 5`}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= displayValue;
        return (
          <button
            key={star}
            type="button"
            disabled={!isInteractive}
            onClick={() => isInteractive && onChange(star)}
            onMouseEnter={() => isInteractive && setHovered(star)}
            className={cn(
              "transition-colors",
              isInteractive
                ? "cursor-pointer hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
                : "cursor-default pointer-events-none",
            )}
            aria-label={isInteractive ? `Rate ${star} star${star !== 1 ? "s" : ""}` : undefined}
          >
            <Star
              className={cn(
                iconClass,
                "transition-colors",
                filled
                  ? "fill-yellow-400 text-yellow-400"
                  : "fill-transparent text-muted-foreground",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
