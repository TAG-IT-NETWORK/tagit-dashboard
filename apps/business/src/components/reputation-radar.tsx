"use client";

import { REPUTATION_DIMENSIONS } from "@/lib/mesh";

/** 6-axis reputation radar. `values` are 0-1 aligned to REPUTATION_DIMENSIONS. */
export function ReputationRadar({ values, size = 240 }: { values: number[]; size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.34;
  const n = REPUTATION_DIMENSIONS.length;

  const point = (i: number, scale: number) => {
    const angle = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return [cx + r * scale * Math.cos(angle), cy + r * scale * Math.sin(angle)] as const;
  };

  const rings = [0.25, 0.5, 0.75, 1];
  const dataPoints = values.map((v, i) => point(i, Math.max(0, Math.min(1, v))));
  const dataPath = dataPoints.map((p) => p.join(",")).join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[280px]">
      {/* grid rings */}
      {rings.map((ring) => (
        <polygon
          key={ring}
          points={Array.from({ length: n }, (_, i) => point(i, ring).join(",")).join(" ")}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={1}
        />
      ))}
      {/* axes */}
      {Array.from({ length: n }, (_, i) => {
        const [x, y] = point(i, 1);
        return (
          <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="hsl(var(--border))" strokeWidth={1} />
        );
      })}
      {/* data polygon */}
      <polygon
        points={dataPath}
        fill="hsl(var(--primary) / 0.15)"
        stroke="hsl(var(--primary))"
        strokeWidth={2}
      />
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={3} fill="hsl(var(--primary))" />
      ))}
      {/* labels */}
      {REPUTATION_DIMENSIONS.map((dim, i) => {
        const [x, y] = point(i, 1.18);
        return (
          <text
            key={dim}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-muted-foreground"
            style={{ fontSize: 9 }}
          >
            {dim}
          </text>
        );
      })}
    </svg>
  );
}
