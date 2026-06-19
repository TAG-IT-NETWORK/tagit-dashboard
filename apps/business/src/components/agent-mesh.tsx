"use client";

import { useMemo } from "react";
import { MESH_CATEGORIES, buildMeshLayout, type LiveAgentRef } from "@/lib/mesh";

const SIZE = 640;

/** Hub-and-spoke agent mesh (§3.1). Reference agent types fan out by category;
 *  real registered agents sit on the inner live ring around the Orchestrator. */
export function AgentMesh({ liveAgents }: { liveAgents: LiveAgentRef[] }) {
  const { hub, nodes, live } = useMemo(() => buildMeshLayout(SIZE, liveAgents), [liveAgents]);

  return (
    <div className="space-y-3">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="w-full"
        role="img"
        aria-labelledby="mesh-title"
      >
        <title id="mesh-title">
          Agent mesh: the Orchestrator hub with {liveAgents.length} registered agents and the
          reference role network around it.
        </title>
        {/* spokes: hub -> reference nodes */}
        {nodes.map((n) => (
          <line
            key={`l-${n.id}`}
            x1={hub.x}
            y1={hub.y}
            x2={n.x}
            y2={n.y}
            stroke={n.stroke}
            strokeOpacity={0.18}
            strokeWidth={1}
          />
        ))}
        {/* spokes: hub -> live agents (solid, emphasized) */}
        {live.map((n) => (
          <line
            key={`ll-${n.id}`}
            x1={hub.x}
            y1={hub.y}
            x2={n.x}
            y2={n.y}
            stroke="#0a0a0a"
            strokeOpacity={0.5}
            strokeWidth={1.5}
          />
        ))}

        {/* reference nodes */}
        {nodes.map((n) => (
          <g key={n.id}>
            <circle cx={n.x} cy={n.y} r={5} fill="white" stroke={n.stroke} strokeWidth={2} />
            <text
              x={n.x}
              y={n.y > hub.y ? n.y + 14 : n.y - 9}
              textAnchor="middle"
              className="fill-muted-foreground"
              style={{ fontSize: 10 }}
            >
              {n.label}
            </text>
          </g>
        ))}

        {/* live registered agents */}
        {live.map((n) => (
          <g key={n.id}>
            <circle cx={n.x} cy={n.y} r={9} fill="#0a0a0a" />
            <circle
              cx={n.x}
              cy={n.y}
              r={13}
              fill="none"
              stroke="#0a0a0a"
              strokeOpacity={0.25}
              strokeWidth={2}
            />
            <text
              x={n.x}
              y={n.y + 3}
              textAnchor="middle"
              fill="white"
              style={{ fontSize: 9, fontWeight: 600 }}
            >
              {n.label}
            </text>
          </g>
        ))}

        {/* hub */}
        <circle cx={hub.x} cy={hub.y} r={26} fill="hsl(var(--primary))" />
        <text
          x={hub.x}
          y={hub.y - 1}
          textAnchor="middle"
          fill="white"
          style={{ fontSize: 11, fontWeight: 700 }}
        >
          TAGIT
        </text>
        <text x={hub.x} y={hub.y + 11} textAnchor="middle" fill="white" style={{ fontSize: 8 }}>
          Orchestrator
        </text>
      </svg>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        {MESH_CATEGORIES.map((c) => (
          <span key={c.key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: c.stroke }} />
            {c.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#0a0a0a]" />
          Live registered agent
        </span>
      </div>
    </div>
  );
}
