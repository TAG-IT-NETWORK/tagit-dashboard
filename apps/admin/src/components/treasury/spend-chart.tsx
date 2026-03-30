"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@tagit/ui";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { BarChart3 } from "lucide-react";
import type { PeriodData } from "@/lib/hooks/use-treasury-spend";

// ─── Helpers ────────────────────────────────────────────────────────────

function formatPeriodLabel(period: string): string {
  const [year, month] = period.split("-");
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const monthIdx = parseInt(month, 10) - 1;
  return `${monthNames[monthIdx]} ${year}`;
}

function formatCompactAmount(value: number): string {
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
  return value.toString();
}

// ─── Component ──────────────────────────────────────────────────────────

interface SpendChartProps {
  byPeriod: PeriodData[];
}

export function SpendChart({ byPeriod }: SpendChartProps) {
  const chartData = byPeriod.map((p) => ({
    period: formatPeriodLabel(p.period),
    deposited: Number(p.deposited),
    spent: Number(p.spent),
    net: Number(p.net),
  }));

  if (chartData.length === 0) {
    return (
      <Card data-testid="spend-chart">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Spend by Period
          </CardTitle>
          <CardDescription>Monthly treasury deposits vs. spending</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="flex items-center justify-center h-[300px] text-muted-foreground"
            data-testid="spend-chart-empty"
          >
            No period data available yet.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="spend-chart">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Spend by Period
        </CardTitle>
        <CardDescription>Monthly treasury deposits vs. spending</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]" data-testid="spend-chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="period"
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <YAxis
                tickFormatter={formatCompactAmount}
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  formatCompactAmount(value),
                  name.charAt(0).toUpperCase() + name.slice(1),
                ]}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Legend />
              <Bar
                dataKey="deposited"
                fill="#22c55e"
                name="Deposited"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="spent"
                fill="#ef4444"
                name="Spent"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
