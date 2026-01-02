import { type ReactNode } from "react";
import { Card, CardContent } from "./card";
import { cn } from "../lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

export interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon?: ReactNode;
  loading?: boolean;
  className?: string;
}

export function MetricCard({
  title,
  value,
  change,
  icon,
  loading = false,
  className,
}: MetricCardProps) {
  return (
    <Card className={cn("", className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {loading ? (
              <div className="h-8 w-24 animate-pulse bg-muted rounded" />
            ) : (
              <p className="text-3xl font-bold">{value}</p>
            )}
            {change !== undefined && !loading && (
              <div
                className={cn(
                  "flex items-center gap-1 text-sm",
                  change >= 0 ? "text-green-500" : "text-red-500"
                )}
              >
                {change >= 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                <span>
                  {change >= 0 ? "+" : ""}
                  {change}%
                </span>
              </div>
            )}
          </div>
          {icon && (
            <div className="p-3 rounded-lg bg-primary/10 text-primary">
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
