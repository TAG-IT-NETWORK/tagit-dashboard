/**
 * Shared passport / verify UI primitives used by both the legacy /sun route and
 * the GS1 Digital Link resolver (/01/...). Server-safe (no client hooks).
 */
import React from "react";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "#000" }}
    >
      <div className="w-full max-w-[420px] py-[52px] px-5">{children}</div>
    </main>
  );
}

export function StatusHero({
  tone,
  glyph,
  title,
  sub,
}: {
  tone: "ok" | "warn" | "bad";
  glyph: string;
  title: string;
  sub: string;
}) {
  const color = tone === "ok" ? "#00D68F" : tone === "warn" ? "#fbbf24" : "#ef4444";
  return (
    <>
      <div className="flex justify-center mb-6 animate-scaleIn">
        <div className="relative w-[100px] h-[100px]">
          <div
            className="absolute inset-0 rounded-full animate-glowPulse"
            style={{ background: `radial-gradient(circle, ${color}40 0%, transparent 70%)` }}
          />
          <div
            className="absolute inset-0 rounded-full"
            style={{ border: `3px solid ${color}`, opacity: 0.3 }}
          />
          <div
            className="absolute inset-[8px] rounded-full flex items-center justify-center"
            style={{ background: `${color}1F` }}
          >
            <span className="text-4xl" style={{ color }}>
              {glyph}
            </span>
          </div>
        </div>
      </div>
      <div className="text-center mb-6 animate-fadeUp" style={{ animationDelay: "0.15s" }}>
        <h1 className="font-syne text-[38px] font-bold leading-tight" style={{ color }}>
          {title}
        </h1>
        <p className="text-gray-500 text-sm mt-1">{sub}</p>
      </div>
    </>
  );
}

export function DataCard({ rows }: { rows: [string, string][] }) {
  return (
    <div
      className="rounded-2xl border border-white/10 p-5 space-y-0 mb-5 animate-fadeUp"
      style={{ background: "rgba(255,255,255,0.03)", animationDelay: "0.35s" }}
    >
      {rows.map(([k, v], i) => (
        <div key={k}>
          {i > 0 && <div className="border-t border-white/5" />}
          <div className="flex justify-between items-center py-3 gap-4">
            <span className="text-gray-500 text-sm whitespace-nowrap">{k}</span>
            <span className="text-white text-sm font-mono text-right break-all">{v}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
